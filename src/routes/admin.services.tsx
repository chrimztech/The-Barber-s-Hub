import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";
import type { Json } from "@/integrations/supabase/types";
import { GalleryEditor } from "@/components/admin/StructuredEditors";

export const Route = createFileRoute("/admin/services")({
  head: () => ({ meta: [{ title: "Manage Services — Admin" }] }),
  component: AdminServices,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || crypto.randomUUID().slice(0, 8);

type Svc = {
  id?: string;
  name: string;
  slug: string;
  short_description: string;
  full_description: string;
  price: number;
  duration: number;
  image_url: string | null;
  category_id: string | null;
  is_featured: boolean;
  status: string;
  gallery_images: string[];
};

const empty: Svc = {
  name: "",
  slug: "",
  short_description: "",
  full_description: "",
  price: 0,
  duration: 30,
  image_url: null,
  category_id: null,
  is_featured: false,
  status: "active",
  gallery_images: [],
};

function AdminServices() {
  const { commerce } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Svc>(empty);

  const services = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () =>
      (await supabase.from("services").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const cats = useQuery({
    queryKey: ["service-cats"],
    queryFn: async () => (await supabase.from("service_categories").select("id,name")).data ?? [],
  });

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (s: Tables<"services">) => {
    setForm({
      id: s.id,
      name: s.name,
      slug: s.slug,
      short_description: s.short_description ?? "",
      full_description: s.full_description ?? "",
      price: s.price,
      duration: s.duration,
      image_url: s.image_url,
      category_id: s.category_id,
      is_featured: s.is_featured,
      status: s.status,
      gallery_images: Array.isArray(s.gallery_images)
        ? s.gallery_images.filter((item): item is string => typeof item === "string")
        : [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const price = Number(form.price);
    const duration = Number(form.duration);
    if (!Number.isFinite(price) || price < 0)
      return toast.error("Price must be a non-negative number");
    if (!Number.isInteger(duration) || duration <= 0)
      return toast.error("Duration must be a positive whole number of minutes");
    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      price,
      duration,
      gallery_images: form.gallery_images as Json,
    };
    const { error } = form.id
      ? await supabase.from("services").update(payload).eq("id", form.id)
      : await supabase.from("services").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    services.refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this service?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    services.refetch();
  };

  return (
    <AdminGuard>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Services</h2>
        <Button
          onClick={openNew}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" /> New service
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(services.data ?? []).map((s) => (
          <div key={s.id} className="border border-border/60 overflow-hidden flex flex-col">
            {s.image_url ? (
              <img src={s.image_url} alt={s.name} className="aspect-video object-cover" />
            ) : (
              <div className="aspect-video bg-muted/40" />
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="flex items-start justify-between">
                <h3 className="font-display text-lg">{s.name}</h3>
                <span className="text-primary font-medium">
                  {formatCurrency(s.price, commerce.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{s.short_description}</p>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {s.duration} min · {s.status}
                {s.is_featured && " · featured"}
              </div>
              <div className="flex gap-2 mt-auto pt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(s.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {(services.data ?? []).length === 0 && (
          <div className="text-muted-foreground text-sm">
            No services yet. Create your first one.
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} service</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              folder="services"
            />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      name: e.target.value,
                      slug: form.id ? form.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                />
              </div>
              <div>
                <Label>Price ({commerce.currency})</Label>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: +e.target.value })}
                />
              </div>
              <div>
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: +e.target.value })}
                />
              </div>
              <div>
                <Label>Category</Label>
                <select
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm h-10"
                  value={form.category_id ?? ""}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
                >
                  <option value="">— none —</option>
                  {(cats.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm h-10"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Short description</Label>
              <Input
                value={form.short_description}
                onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              />
            </div>
            <div>
              <Label>Full description</Label>
              <Textarea
                rows={4}
                value={form.full_description}
                onChange={(e) => setForm({ ...form, full_description: e.target.value })}
              />
            </div>
            <GalleryEditor
              value={form.gallery_images}
              onChange={(gallery_images) => setForm({ ...form, gallery_images })}
              folder="services/gallery"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
              />{" "}
              Featured
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
