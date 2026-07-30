import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RouteError } from "@/components/site/RouteError";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";
import type { Json } from "@/integrations/supabase/types";

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

const slots = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
];

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
    queryFn: async () =>
      (await supabase.from("services").select("id,name,price,duration").eq("status", "active"))
        .data ?? [],
  });
  const barbers = useQuery({
    queryKey: ["barbers"],
    queryFn: async () =>
      (await supabase.from("barbers").select("id,name").eq("status", "active")).data ?? [],
  });

  const [form, setForm] = useState({
    service_id: search.service ?? "",
    barber_id: "",
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    booking_date: "",
    booking_time: "",
    customer_note: "",
  });
  const [saving, setSaving] = useState(false);

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
    const { error } = await supabase.rpc("create_booking", {
      _booking: payload as unknown as Json,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
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
              onChange={(e) => setForm({ ...form, booking_time: e.target.value })}
            >
              <option value="">Pick a time…</option>
              {slots.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
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
