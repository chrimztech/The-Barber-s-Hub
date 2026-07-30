import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin — Deepcuts Hair Studio" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const { commerce } = useSiteSettings();
  const stats = useQuery({
    queryKey: ["admin-stats", commerce.low_stock_threshold],
    queryFn: async () => {
      const [svc, prod, book, ord, cust, low] = await Promise.all([
        supabase.from("services").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("order_status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .lte("stock_quantity", commerce.low_stock_threshold),
      ]);
      return {
        svc: svc.count,
        prod: prod.count,
        book: book.count,
        ord: ord.count,
        cust: cust.count,
        low: low.count,
      };
    },
  });

  const bookings = useQuery({
    queryKey: ["admin-bookings"],
    queryFn: async () =>
      (
        await supabase
          .from("bookings")
          .select("*, services(name)")
          .order("created_at", { ascending: false })
          .limit(10)
      ).data ?? [],
  });

  const orders = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () =>
      (
        await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10)
      ).data ?? [],
  });

  const updateBooking = async (id: string, status: string) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      bookings.refetch();
    }
  };
  const updateOrder = async (id: string, order_status: string) => {
    const { error } = await supabase.from("orders").update({ order_status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      orders.refetch();
    }
  };

  return (
    <AdminGuard>
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { l: "Services", v: stats.data?.svc ?? "—" },
          { l: "Products", v: stats.data?.prod ?? "—" },
          { l: "Pending bookings", v: stats.data?.book ?? "—" },
          { l: "Pending orders", v: stats.data?.ord ?? "—" },
          { l: "Customers", v: stats.data?.cust ?? "—" },
          { l: "Low stock", v: stats.data?.low ?? "—" },
        ].map((s) => (
          <div key={s.l} className="border border-border/60 p-5">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">{s.l}</div>
            <div className="font-display text-3xl mt-2 text-primary">{s.v}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">Recent bookings</h2>
        <Link to="/admin/bookings">
          <Button size="sm" variant="outline">
            View all
          </Button>
        </Link>
      </div>
      <div className="border border-border/60 divide-y divide-border">
        {(bookings.data ?? []).map((b) => (
          <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">
                {b.customer_name} · {(b.services as { name?: string } | null)?.name}
              </div>
              <div className="text-sm text-muted-foreground">
                {b.booking_date} {b.booking_time} · {b.customer_phone}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest px-3 py-1 border border-border rounded-full">
                {b.status}
              </span>
              <select
                defaultValue={b.status}
                onChange={(e) => updateBooking(b.id, e.target.value)}
                className="bg-input border border-border rounded px-2 py-1 text-xs"
              >
                <option value="pending">Pending</option>
                <option value="confirmed">Confirm</option>
                <option value="completed">Complete</option>
                <option value="cancelled">Cancel</option>
                <option value="rejected">Reject</option>
              </select>
            </div>
          </div>
        ))}
        {(bookings.data ?? []).length === 0 && (
          <div className="p-6 text-muted-foreground text-sm">No bookings.</div>
        )}
      </div>

      <div className="mt-12 mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl">Recent orders</h2>
        <Link to="/admin/orders">
          <Button size="sm" variant="outline">
            View all
          </Button>
        </Link>
      </div>
      <div className="border border-border/60 divide-y divide-border">
        {(orders.data ?? []).map((o) => (
          <div key={o.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium">
                {o.order_number} · {o.customer_name}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatDate(o.created_at)} · {formatCurrency(o.total, commerce.currency)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest px-3 py-1 border border-border rounded-full">
                {o.order_status}
              </span>
              <select
                defaultValue={o.order_status}
                onChange={(e) => updateOrder(o.id, e.target.value)}
                className="bg-input border border-border rounded px-2 py-1 text-xs"
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        ))}
        {(orders.data ?? []).length === 0 && (
          <div className="p-6 text-muted-foreground text-sm">No orders.</div>
        )}
      </div>
    </AdminGuard>
  );
}
