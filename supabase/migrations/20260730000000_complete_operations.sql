-- Complete authenticated admin permissions for tables whose RLS policies already
-- restrict writes to users with the admin role.
GRANT INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY "Reviews delete own"
  ON public.reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Customer enquiries
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an enquiry"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins manage enquiries"
  ON public.contact_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER tr_contact_messages_updated
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_contact_messages_status_created
  ON public.contact_messages(status, created_at DESC);

INSERT INTO public.settings (key, value)
VALUES
  (
    'business',
    '{"business_name":"Deepcuts Hair Studio","email":"hello@deepcutshairstudio.com","phone":"+260 97 123 4567","whatsapp":"+260 97 123 4567","address":"Chelston, Lusaka, Zambia","hours":"Tue-Sat 9am-8pm · Sun 10am-4pm · Closed Mon","instagram":"https://instagram.com","facebook":"https://facebook.com","twitter":"https://twitter.com","tiktok":"https://tiktok.com","youtube":"https://youtube.com"}'::jsonb
  ),
  (
    'commerce',
    '{"currency":"ZMW","delivery_fee":15,"pickup_address":"Chelston, Lusaka, Zambia","low_stock_threshold":5}'::jsonb
  )
ON CONFLICT (key) DO NOTHING;

-- Place an order and reserve stock in one transaction. Product names and prices
-- are read from the catalogue instead of trusted from browser state.
CREATE OR REPLACE FUNCTION public.place_order(_order JSONB, _items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_order public.orders;
  item JSONB;
  product public.products;
  item_quantity INTEGER;
  item_price NUMERIC(10,2);
  calculated_subtotal NUMERIC(10,2) := 0;
  calculated_delivery NUMERIC(10,2) := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF COALESCE(_order->>'delivery_method', '') NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'Invalid delivery method';
  END IF;
  IF COALESCE(_order->>'payment_method', '') NOT IN (
    'cash_on_delivery', 'mobile_money', 'bank_transfer'
  ) THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status <> 'active') THEN
    RAISE EXCEPTION 'This account is not permitted to place orders';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'The cart is empty';
  END IF;

  IF COALESCE(_order->>'delivery_method', 'delivery') = 'delivery' THEN
    SELECT COALESCE((value->>'delivery_fee')::NUMERIC, 0)
      INTO calculated_delivery
      FROM public.settings
      WHERE key = 'commerce';
    calculated_delivery := COALESCE(calculated_delivery, 0);
  END IF;

  INSERT INTO public.orders (
    user_id, customer_name, customer_email, customer_phone, delivery_address,
    delivery_method, payment_method, subtotal, delivery_fee, total, order_note
  )
  VALUES (
    auth.uid(), _order->>'customer_name', NULLIF(_order->>'customer_email', ''),
    _order->>'customer_phone', NULLIF(_order->>'delivery_address', ''),
    COALESCE(_order->>'delivery_method', 'delivery'),
    COALESCE(_order->>'payment_method', 'cash_on_delivery'),
    0, calculated_delivery, calculated_delivery, NULLIF(_order->>'order_note', '')
  )
  RETURNING * INTO new_order;

  FOR item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    item_quantity := GREATEST(1, COALESCE((item->>'quantity')::INTEGER, 1));
    SELECT * INTO product
      FROM public.products
      WHERE id = (item->>'product_id')::UUID AND status = 'active'
      FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in the cart is no longer available';
    END IF;
    IF product.stock_quantity < item_quantity THEN
      RAISE EXCEPTION 'Only % of % remain in stock', product.stock_quantity, product.name;
    END IF;

    item_price := COALESCE(product.discount_price, product.price);
    calculated_subtotal := calculated_subtotal + (item_price * item_quantity);
    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price, total_price
    )
    VALUES (
      new_order.id, product.id, product.name, item_quantity, item_price,
      item_price * item_quantity
    );
    UPDATE public.products
      SET stock_quantity = stock_quantity - item_quantity
      WHERE id = product.id;
  END LOOP;

  UPDATE public.orders
    SET subtotal = calculated_subtotal,
        total = calculated_subtotal + calculated_delivery
    WHERE id = new_order.id
    RETURNING * INTO new_order;

  RETURN jsonb_build_object(
    'id', new_order.id,
    'order_number', new_order.order_number,
    'total', new_order.total
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO authenticated;

-- Booking creation uses a server-side capacity check because ordinary customers
-- cannot see other customers' appointments under RLS.
DROP POLICY IF EXISTS "Bookings insert authed" ON public.bookings;
DROP POLICY IF EXISTS "Bookings insert anon" ON public.bookings;
REVOKE INSERT ON public.bookings FROM anon;

CREATE OR REPLACE FUNCTION public.create_booking(_booking JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  requested_date DATE := (_booking->>'booking_date')::DATE;
  requested_time TIME := (_booking->>'booking_time')::TIME;
  requested_barber UUID := NULLIF(_booking->>'barber_id', '')::UUID;
  active_barbers INTEGER;
  occupied_slots INTEGER;
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND status <> 'active'
  ) THEN
    RAISE EXCEPTION 'This account is not permitted to create bookings';
  END IF;
  IF requested_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'The booking date must be in the future';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.services
    WHERE id = (_booking->>'service_id')::UUID AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'The selected service is unavailable';
  END IF;
  IF requested_barber IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.barbers WHERE id = requested_barber AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'The selected barber is unavailable';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(requested_date::TEXT || requested_time::TEXT));

  SELECT COUNT(*) INTO active_barbers
    FROM public.barbers WHERE status = 'active';
  SELECT COUNT(*) INTO occupied_slots
    FROM public.bookings
    WHERE booking_date = requested_date
      AND booking_time = requested_time
      AND status IN ('pending', 'confirmed');

  IF active_barbers = 0 OR occupied_slots >= active_barbers THEN
    RAISE EXCEPTION 'That time is fully booked';
  END IF;
  IF requested_barber IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings
    WHERE booking_date = requested_date
      AND booking_time = requested_time
      AND barber_id = requested_barber
      AND status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'That barber is already booked at this time';
  END IF;

  INSERT INTO public.bookings (
    user_id, service_id, barber_id, customer_name, customer_email,
    customer_phone, booking_date, booking_time, customer_note
  )
  VALUES (
    auth.uid(), (_booking->>'service_id')::UUID, requested_barber,
    _booking->>'customer_name', NULLIF(_booking->>'customer_email', ''),
    _booking->>'customer_phone', requested_date, requested_time,
    NULLIF(_booking->>'customer_note', '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_booking(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking(JSONB) TO anon, authenticated;
