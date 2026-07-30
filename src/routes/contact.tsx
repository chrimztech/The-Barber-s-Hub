import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, MessageCircle, Phone, Send } from "lucide-react";
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

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact - Deepcuts Hair Studio" },
      { name: "description", content: "Visit, call, or message Deepcuts Hair Studio in Lusaka." },
    ],
  }),
  component: Contact,
  errorComponent: RouteError,
});

const schema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().max(30),
  subject: z.string().min(3, "Enter a subject").max(120),
  message: z.string().min(10, "Your message is too short").max(1000),
});

function Contact() {
  const { user } = useAuth();
  const { business } = useSiteSettings();
  const [form, setForm] = useState({
    name: "",
    email: user?.email ?? "",
    phone: "",
    subject: "",
    message: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSaving(true);
    const { error } = await supabase.from("contact_messages").insert({
      ...parsed.data,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      user_id: user?.id ?? null,
    });
    setSaving(false);
    if (error)
      return toast.error("Your message could not be sent. Please call or email us instead.");
    setForm({ ...form, subject: "", message: "" });
    toast.success("Message sent. We will get back to you shortly.");
  };

  const whatsapp = business.whatsapp.replace(/[^\d+]/g, "");
  const contactItems = [
    { Icon: MapPin, title: "Visit", value: business.address, href: undefined },
    { Icon: Phone, title: "Call", value: business.phone, href: `tel:${business.phone}` },
    {
      Icon: MessageCircle,
      title: "WhatsApp",
      value: business.whatsapp,
      href: `https://wa.me/${whatsapp.replace("+", "")}`,
    },
    { Icon: Mail, title: "Email", value: business.email, href: `mailto:${business.email}` },
  ];

  return (
    <SiteLayout>
      <section className="container-x pb-24 pt-16">
        <p className="mb-3 text-xs uppercase tracking-[0.4em] text-primary">Reach out</p>
        <h1 className="font-display text-5xl md:text-6xl">Contact</h1>
        <p className="mt-3 max-w-lg text-muted-foreground">
          Drop by the studio, give us a call, or send an enquiry.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {contactItems.map(({ Icon, title, value, href }) => (
                <div key={title} className="flex gap-4 border-b border-border py-4 first:pt-0">
                  <Icon className="mt-1 h-5 w-5 text-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-widest text-primary">{title}</div>
                    {href ? (
                      <a href={href} className="mt-1 block font-display text-lg hover:text-primary">
                        {value}
                      </a>
                    ) : (
                      <div className="mt-1 font-display text-lg">{value}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 border border-border/60 p-5">
              <div className="text-xs uppercase tracking-widest text-primary">Hours</div>
              <div className="mt-2 text-sm leading-6 text-muted-foreground">{business.hours}</div>
            </div>
          </div>

          <form onSubmit={submit} className="border border-border/60 p-6 md:p-8">
            <h2 className="font-display text-2xl">Send an enquiry</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Subject *</Label>
                <Input
                  value={form.subject}
                  onChange={(event) => setForm({ ...form, subject: event.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Message *</Label>
                <Textarea
                  rows={6}
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                />
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={saving}
              className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Send className="mr-2 h-4 w-4" /> {saving ? "Sending..." : "Send message"}
            </Button>
          </form>
        </div>
      </section>
    </SiteLayout>
  );
}
