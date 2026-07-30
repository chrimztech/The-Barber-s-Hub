import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Eye, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/bookings")({
  head: () => ({ meta: [{ title: "Bookings - Admin" }] }),
  component: AdminBookings,
});

type Booking = Tables<"bookings"> & {
  services: { name: string; price: number; duration: number } | null;
  barbers: { name: string } | null;
};

type BookingEdit = Pick<
  Booking,
  "status" | "booking_date" | "booking_time" | "barber_id" | "admin_note"
>;

const statuses = ["pending", "confirmed", "completed", "cancelled", "rejected"];

function AdminBookings() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [form, setForm] = useState<BookingEdit | null>(null);
  const [saving, setSaving] = useState(false);

  const bookings = useQuery({
    queryKey: ["admin-bookings-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, services(name,price,duration), barbers(name)")
        .order("booking_date", { ascending: false })
        .order("booking_time", { ascending: false });
      if (error) throw error;
      return data as Booking[];
    },
  });

  const barbers = useQuery({
    queryKey: ["admin-booking-barbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id,name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (bookings.data ?? []).filter((booking) => {
      const matchesQuery =
        !needle ||
        booking.customer_name.toLowerCase().includes(needle) ||
        booking.customer_phone.toLowerCase().includes(needle) ||
        booking.customer_email?.toLowerCase().includes(needle) ||
        booking.services?.name.toLowerCase().includes(needle);
      return (
        matchesQuery &&
        (status === "all" || booking.status === status) &&
        (!date || booking.booking_date === date)
      );
    });
  }, [bookings.data, date, query, status]);

  const openBooking = (booking: Booking) => {
    setSelected(booking);
    setForm({
      status: booking.status,
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      barber_id: booking.barber_id,
      admin_note: booking.admin_note,
    });
  };

  const save = async () => {
    if (!selected || !form) return;
    setSaving(true);
    const { error } = await supabase.from("bookings").update(form).eq("id", selected.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Booking updated");
    setSelected(null);
    setForm(null);
    bookings.refetch();
  };

  const remove = async () => {
    if (!selected || !confirm(`Permanently delete the booking for ${selected.customer_name}?`))
      return;
    const { error } = await supabase.from("bookings").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Booking deleted");
    setSelected(null);
    setForm(null);
    bookings.refetch();
  };

  const counts = Object.fromEntries(
    statuses.map((item) => [
      item,
      (bookings.data ?? []).filter((booking) => booking.status === item).length,
    ]),
  );

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Bookings"
        description="Schedule, assign, confirm, and close customer appointments."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {statuses.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(status === item ? "all" : item)}
            className={`border p-4 text-left transition ${status === item ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50"}`}
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{item}</div>
            <div className="mt-1 font-display text-2xl text-primary">{counts[item] ?? 0}</div>
          </button>
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <span className="sr-only">Search bookings</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search customer, phone, email, or service"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-input px-3 text-sm"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Filter by date"
        />
      </div>

      {bookings.isLoading ? (
        <div className="border border-border/60 p-8 text-sm text-muted-foreground">
          Loading bookings...
        </div>
      ) : bookings.isError ? (
        <AdminEmptyState>
          Bookings could not be loaded. Refresh the page to try again.
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState>No bookings match the current filters.</AdminEmptyState>
      ) : (
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Service</TableHead>
                <TableHead className="hidden lg:table-cell">Barber</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((booking) => (
                <TableRow key={booking.id}>
                  <TableCell>
                    <div className="font-medium">
                      {formatDate(`${booking.booking_date}T00:00:00`)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {booking.booking_time.slice(0, 5)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{booking.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{booking.customer_phone}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {booking.services?.name ?? "Unavailable"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {booking.barbers?.name ?? "Unassigned"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={booking.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openBooking(booking)}
                      title="View booking"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">View booking</span>
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
          if (!open) {
            setSelected(null);
            setForm(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Booking details</DialogTitle>
          </DialogHeader>
          {selected && form && (
            <div className="space-y-6">
              <div className="grid gap-4 border-b border-border pb-5 sm:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Customer
                  </div>
                  <div className="mt-1 font-medium">{selected.customer_name}</div>
                  <a
                    className="block text-sm text-primary hover:underline"
                    href={`tel:${selected.customer_phone}`}
                  >
                    {selected.customer_phone}
                  </a>
                  {selected.customer_email && (
                    <a
                      className="block text-sm text-primary hover:underline"
                      href={`mailto:${selected.customer_email}`}
                    >
                      {selected.customer_email}
                    </a>
                  )}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Service
                  </div>
                  <div className="mt-1 font-medium">{selected.services?.name ?? "Unavailable"}</div>
                  {selected.services && (
                    <div className="text-sm text-muted-foreground">
                      {selected.services.duration} minutes
                    </div>
                  )}
                </div>
              </div>

              {selected.customer_note && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Customer note
                  </div>
                  <p className="mt-1 text-sm">{selected.customer_note}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Status</Label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value })}
                  >
                    {statuses.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Assigned barber</Label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                    value={form.barber_id ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, barber_id: event.target.value || null })
                    }
                  >
                    <option value="">Unassigned</option>
                    {(barbers.data ?? []).map((barber) => (
                      <option key={barber.id} value={barber.id}>
                        {barber.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.booking_date}
                    onChange={(event) => setForm({ ...form, booking_date: event.target.value })}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <Input
                    type="time"
                    value={form.booking_time.slice(0, 5)}
                    onChange={(event) => setForm({ ...form, booking_time: event.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Admin note</Label>
                  <Textarea
                    rows={3}
                    value={form.admin_note ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, admin_note: event.target.value || null })
                    }
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelected(null);
                  setForm(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={save}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
