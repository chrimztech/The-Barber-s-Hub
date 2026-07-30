import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/Layout";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout - Deepcuts Hair Studio" }] }),
  component: Checkout,
  errorComponent: RouteError,
});

const schema = z.object({
  customer_name: z.string().min(2).max(80),
  customer_email: z.string().email().max(160).optional().or(z.literal("")),
  customer_phone: z.string().min(6).max(30),
  delivery_address: z.string().max(300),
  delivery_method: z.enum(["delivery", "pickup"]),
  payment_method: z.enum(["cash_on_delivery", "mobile_money", "bank_transfer"]),
  order_note: z.string().max(500).optional(),
});

function Checkout() {
  const { items, subtotal, clear } = useCart();
  const { user } = useAuth();
  const { commerce } = useSiteSettings();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    delivery_address: "",
    delivery_method: "delivery",
    payment_method: "cash_on_delivery",
    order_note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (items.length === 0) navigate({ to: "/cart" });
  }, [items.length, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) {
      toast.error("Please sign in to place an order");
      navigate({ to: "/auth" });
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (form.delivery_method === "delivery" && form.delivery_address.trim().length < 4) {
      return toast.error("Enter a delivery address");
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("place_order", {
      _order: {
        ...parsed.data,
        customer_email: form.customer_email || null,
      } as unknown as Json,
      _items: items.map((item) => ({
        product_id: item.id,
        quantity: item.quantity,
      })) as unknown as Json,
    });
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Order could not be placed");
      return;
    }
    const order = data as { id: string; order_number: string; total: number };
    clear();
    toast.success(`Order ${order.order_number} placed`);
    navigate({ to: "/account/orders/$id", params: { id: order.id } });
  };

  if (!user) {
    return (
      <SiteLayout>
        <div className="container-x py-24 text-center">
          <h2 className="font-display text-3xl">Sign in to checkout</h2>
          <Link to="/auth">
            <Button className="mt-6 bg-primary text-primary-foreground">Sign in</Button>
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const deliveryFee = form.delivery_method === "delivery" ? Number(commerce.delivery_fee) : 0;

  return (
    <SiteLayout>
      <section className="container-x grid gap-10 pb-24 pt-16 lg:grid-cols-[1fr_360px]">
        <form onSubmit={submit} className="space-y-5">
          <h1 className="font-display text-5xl">Checkout</h1>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <Label>Full name *</Label>
              <Input
                value={form.customer_name}
                onChange={(event) => setForm({ ...form, customer_name: event.target.value })}
              />
            </div>
            <div>
              <Label>Phone *</Label>
              <Input
                value={form.customer_phone}
                onChange={(event) => setForm({ ...form, customer_phone: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.customer_email}
                onChange={(event) => setForm({ ...form, customer_email: event.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>
                {form.delivery_method === "delivery" ? "Delivery address *" : "Pickup notes"}
              </Label>
              <Textarea
                rows={2}
                value={form.delivery_address}
                onChange={(event) => setForm({ ...form, delivery_address: event.target.value })}
              />
            </div>
            <div>
              <Label>Delivery method</Label>
              <select
                className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2"
                value={form.delivery_method}
                onChange={(event) => setForm({ ...form, delivery_method: event.target.value })}
              >
                <option value="delivery">
                  Delivery - {formatCurrency(commerce.delivery_fee, commerce.currency)}
                </option>
                <option value="pickup">Pickup - Free</option>
              </select>
            </div>
            <div>
              <Label>Payment</Label>
              <select
                className="mt-1.5 w-full rounded-md border border-border bg-input px-3 py-2"
                value={form.payment_method}
                onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
              >
                <option value="cash_on_delivery">Cash on delivery</option>
                <option value="mobile_money">Mobile money</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <Label>Order note</Label>
              <Textarea
                rows={2}
                value={form.order_note}
                onChange={(event) => setForm({ ...form, order_note: event.target.value })}
              />
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? "Placing order..." : "Place order"}
          </Button>
        </form>

        <aside className="h-fit border border-border/60 p-6">
          <h3 className="font-display text-xl">Summary</h3>
          <div className="mt-4 space-y-2 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  {item.name} x {item.quantity}
                </span>
                <span>{formatCurrency(item.price * item.quantity, commerce.currency)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotal, commerce.currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery</span>
            <span>{formatCurrency(deliveryFee, commerce.currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-lg font-semibold">
            <span>Total</span>
            <span className="text-primary">
              {formatCurrency(subtotal + deliveryFee, commerce.currency)}
            </span>
          </div>
        </aside>
      </section>
    </SiteLayout>
  );
}
