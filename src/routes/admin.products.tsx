import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { api, errorMessage } from "@/lib/api/client";
import type { Category, Product } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";
import {
  GalleryEditor,
  SpecificationEditor,
  type Specification,
} from "@/components/admin/StructuredEditors";

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Manage Products — Admin" }] }),
  component: AdminProducts,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || crypto.randomUUID().slice(0, 8);

type Prod = {
  id?: string;
  name: string;
  slug: string;
  brand: string;
  short_description: string;
  full_description: string;
  price: number;
  discount_price: number | null;
  stock_quantity: number;
  image_url: string | null;
  category_id: string | null;
  is_featured: boolean;
  status: string;
  condition: string;
  gallery_images: string[];
  specifications: Specification[];
};

const empty: Prod = {
  name: "",
  slug: "",
  brand: "",
  short_description: "",
  full_description: "",
  price: 0,
  discount_price: null,
  stock_quantity: 0,
  image_url: null,
  category_id: null,
  is_featured: false,
  status: "active",
  condition: "new",
  gallery_images: [],
  specifications: [],
};

function AdminProducts() {
  const { commerce } = useSiteSettings();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Prod>(empty);

  const products = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => api.get<Product[]>("/admin/products"),
  });
  const cats = useQuery({
    queryKey: ["product-cats"],
    queryFn: () => api.get<Category[]>("/admin/categories/product"),
  });

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand ?? "",
      short_description: p.short_description ?? "",
      full_description: p.full_description ?? "",
      price: p.price,
      discount_price: p.discount_price,
      stock_quantity: p.stock_quantity,
      image_url: p.image_url,
      category_id: p.category_id,
      is_featured: p.is_featured,
      status: p.status,
      condition: p.condition ?? "new",
      gallery_images: Array.isArray(p.gallery_images)
        ? p.gallery_images.filter((item): item is string => typeof item === "string")
        : [],
      specifications:
        p.specifications && typeof p.specifications === "object" && !Array.isArray(p.specifications)
          ? Object.entries(p.specifications).map(([key, value]) => ({
              key,
              value: String(value ?? ""),
            }))
          : [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const price = Number(form.price);
    const discountPrice = form.discount_price ? Number(form.discount_price) : null;
    const stockQuantity = Number(form.stock_quantity);
    if (!Number.isFinite(price) || price < 0)
      return toast.error("Price must be a non-negative number");
    if (discountPrice !== null && (!Number.isFinite(discountPrice) || discountPrice < 0))
      return toast.error("Discount price must be a non-negative number");
    if (discountPrice !== null && discountPrice >= price)
      return toast.error("Discount price must be less than the regular price");
    if (!Number.isInteger(stockQuantity) || stockQuantity < 0)
      return toast.error("Stock quantity must be a non-negative whole number");
    const { id, specifications, ...fields } = form;
    const payload = {
      ...fields,
      slug: form.slug || slugify(form.name),
      price,
      discount_price: discountPrice,
      stock_quantity: stockQuantity,
      specifications: Object.fromEntries(
        specifications
          .filter((item) => item.key.trim())
          .map((item) => [item.key.trim(), item.value.trim()]),
      ),
    };
    try {
      if (id) await api.put(`/admin/products/${id}`, payload);
      else await api.post("/admin/products", payload);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success("Saved");
    setOpen(false);
    products.refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await api.delete(`/admin/products/${id}`);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success("Deleted");
    products.refetch();
  };

  return (
    <AdminGuard>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Products</h2>
        <Button
          onClick={openNew}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" /> New product
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(products.data ?? []).map((p) => (
          <div key={p.id} className="border border-border/60 overflow-hidden flex flex-col">
            {p.image_url ? (
              <img src={p.image_url} alt={p.name} className="aspect-square object-cover" />
            ) : (
              <div className="aspect-square bg-muted/40" />
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-lg leading-tight">{p.name}</h3>
                <div className="text-right">
                  {p.discount_price ? (
                    <>
                      <div className="text-primary font-medium">
                        {formatCurrency(p.discount_price, commerce.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground line-through">
                        {formatCurrency(p.price, commerce.currency)}
                      </div>
                    </>
                  ) : (
                    <div className="text-primary font-medium">
                      {formatCurrency(p.price, commerce.currency)}
                    </div>
                  )}
                </div>
              </div>
              {p.brand && <div className="text-xs text-muted-foreground">{p.brand}</div>}
              <div
                className={
                  "text-[11px] uppercase tracking-widest " +
                  (p.stock_quantity < 5 ? "text-destructive" : "text-muted-foreground")
                }
              >
                Stock: {p.stock_quantity} · {p.status}
                {p.is_featured && " · featured"}
              </div>
              <div className="flex gap-2 mt-auto pt-3">
                <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(p.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {(products.data ?? []).length === 0 && (
          <div className="text-muted-foreground text-sm">No products yet. Add your first one.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} product</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              folder="products"
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
                <Label>Brand</Label>
                <Input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
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
                <Label>Price ({commerce.currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: +e.target.value })}
                />
              </div>
              <div>
                <Label>Discount price ({commerce.currency})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.discount_price ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, discount_price: e.target.value ? +e.target.value : null })
                  }
                />
              </div>
              <div>
                <Label>Stock quantity</Label>
                <Input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: +e.target.value })}
                />
              </div>
              <div>
                <Label>Condition</Label>
                <select
                  className="w-full bg-input border border-border rounded px-3 py-2 text-sm h-10"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                >
                  <option value="new">New</option>
                  <option value="refurbished">Refurbished</option>
                  <option value="used">Used</option>
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
              folder="products/gallery"
            />
            <SpecificationEditor
              value={form.specifications}
              onChange={(specifications) => setForm({ ...form, specifications })}
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
