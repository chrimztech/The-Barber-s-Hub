import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api/client";
import type { Availability, Barber, Service } from "@/lib/api/types";
import { useAuth } from "@/hooks/useAuth";
import { RouteError } from "@/components/site/RouteError";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Book Appointment — Deepcuts Hair Studio" },
      { name: "description", content: "Reserve your chair in seconds." },
    ],
  }),
  component: Book,
  errorComponent: RouteError,
});

const schema = z.object({
  service_id: z.string().uuid("Pick a service"),
  barber_id: z.string().uuid().optional().or(z.literal("")),
  customer_name: z.string().min(2).max(80),
  customer_email: z.string().email().max(160).optional().or(z.literal("")),
  customer_phone: z.string().min(6).max(30),
  booking_date: z.string().min(1, "Pick a date"),
  booking_time: z.string().min(1, "Pick a time"),
  customer_note: z.string().max(500).optional(),
});

function Book() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { commerce } = useSiteSettings();
  const services = useQuery({
    queryKey: ["svc"],
    queryFn: () => api.get<Service[]>("/services"),
  });
  const barbers = useQuery({
    queryKey: ["barbers"],
    queryFn: () => api.get<Barber[]>("/barbers"),
  });

  const [form, setForm] = useState({
    service_id: search.service ?? "",
    barber_id: "",
    customer_name: user?.full_name ?? "",
    customer_email: "",
    customer_phone: user?.phone ?? "",
    booking_date: "",
    booking_time: "",
    customer_note: "",
  });
  const [saving, setSaving] = useState(false);

  // Fill in the signed-in customer's details once their session has loaded.
  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      customer_name: current.customer_name || user.full_name || "",
      customer_phone: current.customer_phone || user.phone || "",
    }));
  }, [user]);

  // Real availability for the chosen date, service, and barber (opening hours,
  // past times today, and already-booked slots are all excluded by the API).
  const availability = useQuery({
    enabled: !!form.booking_date,
    queryKey: ["availability", form.booking_date, form.service_id, form.barber_id],
    queryFn: () =>
      api.get<Availability>("/bookings/availability", {
        date: form.booking_date,
        service_id: form.service_id || undefined,
        barber_id: form.barber_id || undefined,
      }),
  });
  const openSlots = (availability.data?.slots ?? []).filter((slot) => slot.available);

  // Drop the chosen time if it stops being available (e.g. the barber changed).
  useEffect(() => {
    if (
      form.booking_time &&
      availability.data &&
      !openSlots.some((s) => s.time === form.booking_time)
    ) {
      setForm((current) => ({ ...current, booking_time: "" }));
    }
  }, [availability.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const timePlaceholder = !form.booking_date
    ? "Pick a date first"
    : availability.isLoading
      ? "Checking availability…"
      : availability.isError
        ? "Couldn't load times"
        : availability.data && !availability.data.open
          ? "Closed on this day"
          : openSlots.length === 0
            ? "Fully booked — try another day"
            : "Pick a time…";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const payload = {
      ...parsed.data,
      barber_id: form.barber_id || null,
      customer_email: form.customer_email || null,
    };
    try {
      await api.post("/bookings", payload);
    } catch (error) {
      setSaving(false);
      toast.error(errorMessage(error));
      return;
    }
    setSaving(false);
    toast.success("Booking received! We'll confirm shortly.");
    navigate({ to: user ? "/account" : "/" });
  };

  return (
    <SiteLayout>
      <section className="container-x pt-16 pb-24 max-w-3xl">
        <p className="text-primary text-xs tracking-[0.4em] uppercase mb-3">Reserve</p>
        <h1 className="font-display text-5xl">Book your chair</h1>
        <p className="text-muted-foreground mt-3">
          We'll confirm your appointment by phone or email within a few hours.
        </p>
        <form onSubmit={submit} className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Service *</Label>
            <select
              className="w-full mt-1.5 bg-input border border-border rounded-md px-3 py-2"
              disabled={services.isLoading}
              value={form.service_id}
              onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            >
              <option value="">
                {services.isLoading
                  ? "Loading services…"
                  : services.isError
                    ? "Couldn't load services"
                    : "Choose a service…"}
              </option>
              {(services.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} - {formatCurrency(s.price, commerce.currency)} · {s.duration} min
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>Preferred barber (optional)</Label>
            <select
              className="w-full mt-1.5 bg-input border border-border rounded-md px-3 py-2"
              disabled={barbers.isLoading}
              value={form.barber_id}
              onChange={(e) => setForm({ ...form, barber_id: e.target.value })}
            >
              <option value="">{barbers.isLoading ? "Loading…" : "No preference"}</option>
              {(barbers.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Date *</Label>
            <Input
              type="date"
              min={new Date().toISOString().split("T")[0]}
              value={form.booking_date}
              onChange={(e) => setForm({ ...form, booking_date: e.target.value })}
            />
          </div>
          <div>
            <Label>Time *</Label>
            <select
              className="w-full mt-1.5 bg-input border border-border rounded-md px-3 py-2"
              value={form.booking_time}
              disabled={!form.booking_date || openSlots.length === 0}
              onChange={(e) => setForm({ ...form, booking_time: e.target.value })}
            >
              <option value="">{timePlaceholder}</option>
              {openSlots.map((slot) => (
                <option key={slot.time} value={slot.time}>
                  {slot.time}
                </option>
              ))}
            </select>
            {availability.data?.hours && (
              <p className="mt-1 text-xs text-muted-foreground">
                Open {availability.data.hours.open}–{availability.data.hours.close} that day
              </p>
            )}
          </div>
          <div>
            <Label>Full name *</Label>
            <Input
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input
              value={form.customer_phone}
              onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.customer_email}
              onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={form.customer_note}
              onChange={(e) => setForm({ ...form, customer_note: e.target.value })}
              placeholder="Anything we should know?"
            />
          </div>
          <div className="md:col-span-2 mt-2">
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-full md:w-auto"
            >
              {saving ? "Reserving…" : "Reserve appointment"}
            </Button>
          </div>
        </form>
      </section>
    </SiteLayout>
  );
}
