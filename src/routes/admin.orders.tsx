import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminEmptyState, AdminPageHeader, StatusBadge } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatCurrency, formatDate } from "@/lib/format";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders - Admin" }] }),
  component: AdminOrders,
});

type Order = Tables<"orders">;
const orderStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
const paymentStatuses = ["unpaid", "paid", "failed", "refunded"];

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function AdminOrders() {
  const { commerce } = useSiteSettings();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Order | null>(null);
  const [orderStatus, setOrderStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const orders = useQuery({
    queryKey: ["admin-orders-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    enabled: !!selected,
    queryKey: ["admin-order-items", selected?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", selected!.id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (orders.data ?? []).filter((order) => {
      const matches =
        !needle ||
        order.order_number.toLowerCase().includes(needle) ||
        order.customer_name.toLowerCase().includes(needle) ||
        order.customer_phone.toLowerCase().includes(needle) ||
        order.customer_email?.toLowerCase().includes(needle);
      return matches && (status === "all" || order.order_status === status);
    });
  }, [orders.data, query, status]);

  const openOrder = (order: Order) => {
    setSelected(order);
    setOrderStatus(order.order_status);
    setPaymentStatus(order.payment_status);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("orders")
      .update({ order_status: orderStatus, payment_status: paymentStatus })
      .eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Order updated");
    setSelected(null);
    orders.refetch();
  };

  const exportCsv = () => {
    const header = ["Order", "Date", "Customer", "Phone", "Total", "Payment", "Status"];
    const rows = filtered.map((order) => [
      order.order_number,
      order.created_at,
      order.customer_name,
      order.customer_phone,
      order.total,
      order.payment_status,
      order.order_status,
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Orders"
        description="Track fulfilment, payment, and customer delivery details."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="relative">
          <span className="sr-only">Search orders</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search order, customer, phone, or email"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-input px-3 text-sm"
          aria-label="Filter by order status"
        >
          <option value="all">All statuses</option>
          {orderStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      {orders.isLoading ? (
        <div className="border border-border/60 p-8 text-sm text-muted-foreground">
          Loading orders...
        </div>
      ) : orders.isError ? (
        <AdminEmptyState>
          Orders could not be loaded. Refresh the page to try again.
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState>No orders match the current filters.</AdminEmptyState>
      ) : (
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="font-medium">{order.order_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{order.customer_phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StatusBadge status={order.payment_status} />
                  </TableCell>
                  <TableCell className="font-medium text-primary">
                    {formatCurrency(order.total, commerce.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.order_status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openOrder(order)}
                      title="View order"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View order</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{selected?.order_number}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-6">
              <div className="grid gap-5 border-b border-border pb-5 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Customer
                  </div>
                  <div className="mt-1 font-medium">{selected.customer_name}</div>
                  <a
                    href={`tel:${selected.customer_phone}`}
                    className="block text-sm text-primary hover:underline"
                  >
                    {selected.customer_phone}
                  </a>
                  {selected.customer_email && (
                    <a
                      href={`mailto:${selected.customer_email}`}
                      className="block text-sm text-primary hover:underline"
                    >
                      {selected.customer_email}
                    </a>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Delivery
                  </div>
                  <div className="mt-1 text-sm capitalize">{selected.delivery_method}</div>
                  <div className="text-sm text-muted-foreground">
                    {selected.delivery_address ?? commerce.pickup_address}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
                  Items
                </div>
                <div className="divide-y divide-border border border-border/60">
                  {items.isLoading && (
                    <div className="p-4 text-sm text-muted-foreground">Loading items...</div>
                  )}
                  {(items.data ?? []).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-4 p-3 text-sm"
                    >
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(item.unit_price, commerce.currency)}
                        </div>
                      </div>
                      <div>{formatCurrency(item.total_price, commerce.currency)}</div>
                    </div>
                  ))}
                </div>
                <div className="ml-auto mt-3 max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selected.subtotal, commerce.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span>{formatCurrency(selected.delivery_fee, commerce.currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                    <span>Total</span>
                    <span className="text-primary">
                      {formatCurrency(selected.total, commerce.currency)}
                    </span>
                  </div>
                </div>
              </div>

              {selected.order_note && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Customer note
                  </div>
                  <p className="mt-1 text-sm">{selected.order_note}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Order status</Label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                    value={orderStatus}
                    onChange={(event) => setOrderStatus(event.target.value)}
                  >
                    {orderStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Payment status</Label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                    value={paymentStatus}
                    onChange={(event) => setPaymentStatus(event.target.value)}
                  >
                    {paymentStatuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
