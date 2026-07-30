import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Package, ReceiptText } from "lucide-react";
import { AccountNav } from "@/components/account/AccountNav";
import { StatusBadge } from "@/components/admin/AdminUi";
import { SiteLayout } from "@/components/site/Layout";
import { RouteError } from "@/components/site/RouteError";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/account/orders/$id")({
  head: () => ({ meta: [{ title: "Order Details - Deepcuts Hair Studio" }] }),
  component: OrderDetail,
  errorComponent: RouteError,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const { commerce } = useSiteSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const order = useQuery({
    enabled: !!user,
    queryKey: ["my-order", id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    enabled: !!order.data,
    queryKey: ["my-order-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", id)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  if (loading || !user) {
    return (
      <SiteLayout>
        <div className="container-x py-16 text-sm text-muted-foreground">Loading order...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="container-x max-w-5xl py-16">
        <p className="mb-2 text-xs uppercase tracking-[0.4em] text-primary">Account</p>
        <h1 className="mb-6 font-display text-4xl">Order details</h1>
        <AccountNav />
        <Link
          to="/account"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to account
        </Link>

        {order.isLoading ? (
          <div className="mt-8 border border-border/60 p-8 text-sm text-muted-foreground">
            Loading order...
          </div>
        ) : order.isError || !order.data ? (
          <div className="mt-8 border border-dashed border-border p-10 text-center">
            <h2 className="font-display text-2xl">Order not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This order is unavailable or does not belong to your account.
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border pb-6">
              <div>
                <h2 className="font-display text-3xl">{order.data.order_number}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Placed {formatDate(order.data.created_at, { dateStyle: "long" })}
                </p>
              </div>
              <div className="flex gap-2">
                <StatusBadge status={order.data.payment_status} />
                <StatusBadge status={order.data.order_status} />
              </div>
            </div>

            <div className="grid gap-8 py-8 lg:grid-cols-[1fr_320px]">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-display text-xl">Items</h3>
                </div>
                <div className="divide-y divide-border border border-border/60">
                  {items.isLoading && (
                    <div className="p-5 text-sm text-muted-foreground">Loading items...</div>
                  )}
                  {(items.data ?? []).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-5 p-4">
                      <div>
                        <div className="font-medium">{item.product_name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Qty {item.quantity} · {formatCurrency(item.unit_price, commerce.currency)}{" "}
                          each
                        </div>
                      </div>
                      <div className="font-medium">
                        {formatCurrency(item.total_price, commerce.currency)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="space-y-6">
                <div className="border border-border/60 p-5">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-xl">Summary</h3>
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(order.data.subtotal, commerce.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivery</span>
                      <span>{formatCurrency(order.data.delivery_fee, commerce.currency)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                      <span>Total</span>
                      <span className="text-primary">
                        {formatCurrency(order.data.total, commerce.currency)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-5 border-t border-border pt-4 text-sm">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      Payment
                    </div>
                    <div className="mt-1">{titleCase(order.data.payment_method)}</div>
                  </div>
                </div>
                <div className="border border-border/60 p-5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="font-display text-xl">
                      {order.data.delivery_method === "pickup" ? "Pickup" : "Delivery"}
                    </h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {order.data.delivery_address || commerce.pickup_address}
                  </p>
                </div>
              </aside>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
