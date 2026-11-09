import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AccountNav } from "@/components/account/AccountNav";
import { StatusBadge } from "@/components/admin/AdminUi";
import { SiteLayout } from "@/components/site/Layout";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { api, errorMessage } from "@/lib/api/client";
import type { Booking, Order, Profile } from "@/lib/api/types";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/account/")({
  head: () => ({ meta: [{ title: "My Account - Deepcuts Hair Studio" }] }),
  component: Account,
  errorComponent: RouteError,
});

function Account() {
  const { user, loading, isAdmin } = useAuth();
  const { commerce } = useSiteSettings();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["my-profile", user?.id],
    queryFn: () => api.get<Profile | null>("/me/profile"),
  });

  const bookings = useQuery({
    enabled: !!user,
    queryKey: ["my-bookings", user?.id],
    queryFn: () => api.get<Booking[]>("/me/bookings"),
  });

  const orders = useQuery({
    enabled: !!user,
    queryKey: ["my-orders", user?.id],
    queryFn: () => api.get<Order[]>("/me/orders"),
  });

  const cancelBooking = async (id: string) => {
    if (!user || !confirm("Cancel this appointment?")) return;
    try {
      await api.post(`/me/bookings/${id}/cancel`);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success("Appointment cancelled");
    bookings.refetch();
  };

  if (loading || !user) {
    return (
      <SiteLayout>
        <section className="container-x max-w-5xl py-16">
          <p className="text-muted-foreground">Loading your account...</p>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="container-x max-w-5xl py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.4em] text-primary">Welcome</p>
            <h1 className="font-display text-4xl">{profile.data?.full_name || user.email}</h1>
          </div>
          {isAdmin && (
            <Link to="/admin">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                Admin dashboard
              </Button>
            </Link>
          )}
        </div>

        <div className="mt-8">
          <AccountNav />
        </div>

        <h2 className="mb-4 mt-10 font-display text-2xl">My bookings</h2>
        {bookings.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading bookings...</p>
        ) : bookings.isError ? (
          <p className="text-sm text-muted-foreground">
            Bookings could not be loaded. Please refresh.
          </p>
        ) : (bookings.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No bookings yet.{" "}
            <Link to="/book" className="text-primary hover:underline">
              Book an appointment
            </Link>
          </p>
        ) : (
          <div className="divide-y divide-border border border-border/60">
            {bookings.data!.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <div className="font-medium">{booking.services?.name ?? "Service"}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(`${booking.booking_date}T00:00:00`)} ·{" "}
                    {booking.booking_time.slice(0, 5)}
                    {booking.barbers?.name && ` · ${booking.barbers.name}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={booking.status} />
                  {["pending", "confirmed"].includes(booking.status) && (
                    <Button size="sm" variant="ghost" onClick={() => cancelBooking(booking.id)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h2 className="mb-4 mt-12 font-display text-2xl">My orders</h2>
        {orders.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : orders.isError ? (
          <p className="text-sm text-muted-foreground">
            Orders could not be loaded. Please refresh.
          </p>
        ) : (orders.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders yet.{" "}
            <Link to="/shop" className="text-primary hover:underline">
              Browse the shop
            </Link>
          </p>
        ) : (
          <div className="divide-y divide-border border border-border/60">
            {orders.data!.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-medium">{order.order_number}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(order.created_at)}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-primary">
                    {formatCurrency(order.total, commerce.currency)}
                  </span>
                  <StatusBadge status={order.order_status} />
                  <Link to="/account/orders/$id" params={{ id: order.id }}>
                    <Button size="sm" variant="outline">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
