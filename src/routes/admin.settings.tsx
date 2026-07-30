import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminPageHeader } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultBusinessSettings,
  defaultCommerceSettings,
  useSiteSettings,
  type BusinessSettings,
  type CommerceSettings,
} from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings - Admin" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const settings = useSiteSettings();
  const [business, setBusiness] = useState<BusinessSettings>(defaultBusinessSettings);
  const [commerce, setCommerce] = useState<CommerceSettings>(defaultCommerceSettings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setBusiness(settings.data.business);
      setCommerce(settings.data.commerce);
    }
  }, [settings.data]);

  const save = async () => {
    const deliveryFee = Number(commerce.delivery_fee);
    const lowStock = Number(commerce.low_stock_threshold);
    if (!business.business_name.trim()) return toast.error("Business name is required");
    if (!Number.isFinite(deliveryFee) || deliveryFee < 0)
      return toast.error("Delivery fee must be a non-negative number");
    if (!Number.isInteger(lowStock) || lowStock < 0)
      return toast.error("Low stock threshold must be a whole number");
    setSaving(true);
    const { error } = await supabase.from("settings").upsert(
      [
        { key: "business", value: business as unknown as Json },
        {
          key: "commerce",
          value: {
            ...commerce,
            delivery_fee: deliveryFee,
            low_stock_threshold: lowStock,
          } as unknown as Json,
        },
      ],
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) return toast.error(error.message);
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
          Settings could not be loaded. Apply the latest Supabase migration before saving.
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
              <Label>Opening hours</Label>
              <Input
                value={business.hours}
                onChange={(event) => setBusiness({ ...business, hours: event.target.value })}
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
