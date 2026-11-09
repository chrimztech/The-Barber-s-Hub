// Shapes returned by the REST API (see /server). Timestamps are ISO strings,
// dates are "YYYY-MM-DD", times are "HH:MM:SS", and prices are numbers.

export type Named = { name: string } | null;

export type AuthUser = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  isAdmin: boolean;
  /** False for Google-only accounts that haven't set a password yet. */
  hasPassword: boolean;
};

export type Availability = {
  date: string;
  open: boolean;
  hours: { open: string; close: string } | null;
  slots: { time: string; available: boolean }[];
};

export type AuthResponse = { token: string; user: AuthUser };

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type AdminCustomer = Profile & {
  isAdmin: boolean;
  booking_count: number;
  order_count: number;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  price: number;
  duration: number;
  category_id: string | null;
  image_url: string | null;
  gallery_images: string[];
  is_featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  service_categories?: Named;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  price: number;
  discount_price: number | null;
  stock_quantity: number;
  category_id: string | null;
  brand: string | null;
  condition: string | null;
  specifications: Record<string, string>;
  image_url: string | null;
  gallery_images: string[];
  is_featured: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  product_categories?: Named;
};

export type Barber = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  phone?: string | null;
  specialty: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
};

export type Booking = {
  id: string;
  user_id: string | null;
  service_id: string | null;
  barber_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  status: string;
  customer_note: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  services: { name: string; price: number; duration: number } | null;
  barbers: Named;
};

export type Order = {
  id: string;
  user_id: string | null;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  delivery_address: string | null;
  delivery_method: string;
  payment_method: string;
  payment_status: string;
  order_status: string;
  subtotal: number;
  delivery_fee: number;
  total: number;
  order_note: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
};

export type OrderWithItems = Order & { items: OrderItem[] };

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

export type Review = {
  id: string;
  user_id: string;
  service_id: string | null;
  product_id: string | null;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
  products: Named;
  services: Named;
};

export type ContactMessage = {
  id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  message: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminStats = {
  services: number;
  products: number;
  pending_bookings: number;
  pending_orders: number;
  customers: number;
  low_stock: number;
  unread_messages: number;
  pending_reviews: number;
};
