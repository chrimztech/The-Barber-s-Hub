import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminPageHeader } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultBookingSettings,
  defaultBusinessSettings,
  defaultCommerceSettings,
  defaultPaymentSettings,
  useSiteSettings,
  WEEKDAYS,
  type BookingSettings,
  type BusinessSettings,
  type CommerceSettings,
  type PaymentSettings,
  type Weekday,
} from "@/hooks/useSiteSettings";
import { api, errorMessage } from "@/lib/api/client";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const settings = useSiteSettings();
  const [business, setBusiness] = useState<BusinessSettings>(defaultBusinessSettings);
  const [commerce, setCommerce] = useState<CommerceSettings>(defaultCommerceSettings);
  const [booking, setBooking] = useState<BookingSettings>(defaultBookingSettings);
  const [payments, setPayments] = useState<PaymentSettings>(defaultPaymentSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setBusiness(settings.data.business);
      setCommerce(settings.data.commerce);
      setBooking(settings.data.booking);
      setPayments(settings.data.payments);
    }
  }, [settings.data]);

  const setDay = (day: Weekday, hours: BookingSettings["hours"][Weekday]) =>
    setBooking({ ...booking, hours: { ...booking.hours, [day]: hours } });

  const save = async () => {
    const deliveryFee = Number(commerce.delivery_fee);
    const lowStock = Number(commerce.low_stock_threshold);
    if (!business.business_name.trim()) return toast.error("Business name is required");
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0)
      return toast.error("Delivery fee must be a non-negative number");
    if (!Number.isInteger(lowStock) || lowStock < 0)
      return toast.error("Low stock threshold must be a whole number");
    for (const { key, label } of WEEKDAYS) {
      const day = booking.hours[key];
      if (day && day.open >= day.close)
        return toast.error(`${label}: closing must be after opening`);
    }
    setSaving(true);
    try {
      await api.put("/admin/settings", {
        business,
        commerce: { ...commerce, delivery_fee: deliveryFee, low_stock_threshold: lowStock },
        booking: { ...booking, slot_minutes: Number(booking.slot_minutes) },
        payments,
      });
    } catch (error) {
      setSaving(false);
      return toast.error(errorMessage(error));
    }
    setSaving(false);
    toast.success("Settings saved");
    settings.refetch();
  };

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Settings"
        description="Control the business details shown across the storefront and checkout."
        action={
          <Button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving..." : "Save settings"}
          </Button>
        }
      />

      {settings.isError && (
        <div className="mb-5 border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive-foreground">
          Settings could not be loaded. Check that the API is running before saving.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h3 className="font-display text-xl">Business profile</h3>
          <div className="mt-4 grid gap-4 border border-border/60 p-5">
            <div>
              <Label>Business name</Label>
              <Input
                value={business.business_name}
                onChange={(event) =>
                  setBusiness({ ...business, business_name: event.target.value })
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={business.email}
                  onChange={(event) => setBusiness({ ...business, email: event.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={business.phone}
                  onChange={(event) => setBusiness({ ...business, phone: event.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>WhatsApp number</Label>
              <Input
                value={business.whatsapp}
                onChange={(event) => setBusiness({ ...business, whatsapp: event.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={business.address}
                onChange={(event) => setBusiness({ ...business, address: event.target.value })}
              />
            </div>
            <div>
              <Label>Opening hours (text shown on the site)</Label>
              <Input
                value={business.hours}
                onChange={(event) => setBusiness({ ...business, hours: event.target.value })}
              />
            </div>
          </div>

          <h3 className="mt-8 font-display text-xl">Booking hours</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Customers can only book within these hours. Times are studio-local.
          </p>
          <div className="mt-4 grid gap-3 border border-border/60 p-5">
            {WEEKDAYS.map(({ key, label }) => {
              const day = booking.hours[key];
              return (
                <div key={key} className="grid grid-cols-[110px_auto_1fr] items-center gap-3">
                  <span className="text-sm">{label}</span>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!day}
                      onChange={(event) =>
                        setDay(key, event.target.checked ? { open: "09:00", close: "18:00" } : null)
                      }
                    />
                    Open
                  </label>
                  {day ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        aria-label={`${label} opening time`}
                        value={day.open}
                        onChange={(event) => setDay(key, { ...day, open: event.target.value })}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        aria-label={`${label} closing time`}
                        value={day.close}
                        onChange={(event) => setDay(key, { ...day, close: event.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Closed</span>
                  )}
                </div>
              );
            })}
            <div className="mt-2">
              <Label>Time between appointment slots</Label>
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                value={booking.slot_minutes}
                onChange={(event) =>
                  setBooking({ ...booking, slot_minutes: Number(event.target.value) })
                }
              >
                {[15, 20, 30, 45, 60, 90, 120].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    Every {minutes} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3 className="mt-8 font-display text-xl">Payment details</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Shown at checkout and on the order page for mobile money and bank transfer orders.
          </p>
          <div className="mt-4 grid gap-4 border border-border/60 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Mobile money number</Label>
                <Input
                  value={payments.mobile_money_number}
                  onChange={(event) =>
                    setPayments({ ...payments, mobile_money_number: event.target.value })
                  }
                />
              </div>
              <div>
                <Label>Registered name</Label>
                <Input
                  value={payments.mobile_money_name}
                  onChange={(event) =>
                    setPayments({ ...payments, mobile_money_name: event.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Bank transfer details</Label>
              <Textarea
                rows={3}
                placeholder={"Bank, branch, account name, account number"}
                value={payments.bank_details}
                onChange={(event) => setPayments({ ...payments, bank_details: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="font-display text-xl">Commerce</h3>
          <div className="mt-4 grid gap-4 border border-border/60 p-5">
            <div>
              <Label>Currency</Label>
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                value={commerce.currency}
                onChange={(event) => setCommerce({ ...commerce, currency: event.target.value })}
              >
                <option value="ZMW">ZMW - Zambian kwacha</option>
                <option value="USD">USD - US dollar</option>
              </select>
            </div>
            <div>
              <Label>Delivery fee</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={commerce.delivery_fee}
                onChange={(event) =>
                  setCommerce({ ...commerce, delivery_fee: Number(event.target.value) })
                }
              />
            </div>
            <div>
              <Label>Pickup address</Label>
              <Input
                value={commerce.pickup_address}
                onChange={(event) =>
                  setCommerce({ ...commerce, pickup_address: event.target.value })
                }
              />
            </div>
            <div>
              <Label>Low stock threshold</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={commerce.low_stock_threshold}
                onChange={(event) =>
                  setCommerce({ ...commerce, low_stock_threshold: Number(event.target.value) })
                }
              />
            </div>
          </div>

          <h3 className="mt-8 font-display text-xl">Social links</h3>
          <div className="mt-4 grid gap-4 border border-border/60 p-5">
            <div>
              <Label>Instagram URL</Label>
              <Input
                type="url"
                value={business.instagram}
                onChange={(event) => setBusiness({ ...business, instagram: event.target.value })}
              />
            </div>
            <div>
              <Label>Facebook URL</Label>
              <Input
                type="url"
                value={business.facebook}
                onChange={(event) => setBusiness({ ...business, facebook: event.target.value })}
              />
            </div>
            <div>
              <Label>Twitter URL</Label>
              <Input
                type="url"
                value={business.twitter}
                onChange={(event) => setBusiness({ ...business, twitter: event.target.value })}
              />
            </div>
            <div>
              <Label>TikTok URL</Label>
              <Input
                type="url"
                value={business.tiktok}
                onChange={(event) => setBusiness({ ...business, tiktok: event.target.value })}
              />
            </div>
            <div>
              <Label>YouTube URL</Label>
              <Input
                type="url"
                value={business.youtube}
                onChange={(event) => setBusiness({ ...business, youtube: event.target.value })}
              />
            </div>
          </div>
        </section>
      </div>
    </AdminGuard>
  );
}
