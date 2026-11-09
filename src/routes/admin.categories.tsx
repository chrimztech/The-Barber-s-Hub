import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { api, errorMessage } from "@/lib/api/client";
import type { Category } from "@/lib/api/types";
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

export const Route = createFileRoute("/admin/categories")({
  head: () => ({ meta: [{ title: "Manage Categories — Admin" }] }),
  component: AdminCategories,
});

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || crypto.randomUUID().slice(0, 8);

type Cat = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  status: string;
};
const empty: Cat = { name: "", slug: "", description: "", image_url: null, status: "active" };

function CategoryPanel({ table, title }: { table: "service" | "product"; title: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Cat>(empty);

  const list = useQuery({
    queryKey: ["cats", table],
    queryFn: () => api.get<Category[]>(`/admin/categories/${table}`),
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const { id, ...fields } = form;
    const payload = { ...fields, slug: form.slug || slugify(form.name) };
    try {
      if (id) await api.put(`/admin/categories/${table}/${id}`, payload);
      else await api.post(`/admin/categories/${table}`, payload);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success("Saved");
    setOpen(false);
    list.refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    try {
      await api.delete(`/admin/categories/${table}/${id}`);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    list.refetch();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xl">{title}</h3>
        <Button
          size="sm"
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3 w-3 mr-1" /> New
        </Button>
      </div>
      <div className="border border-border/60 divide-y divide-border">
        {(list.data ?? []).map((c) => (
          <div key={c.id} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {c.image_url && (
                <img
                  src={c.image_url}
                  alt=""
                  className="h-10 w-10 object-cover border border-border"
                />
              )}
              <div className="min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.slug} · {c.status}
                </div>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setForm({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    description: c.description ?? "",
                    image_url: c.image_url,
                    status: c.status,
                  });
                  setOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove(c.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">No categories yet.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} category</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ImageUpload
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              folder="categories"
            />
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
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
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
    </div>
  );
}

function AdminCategories() {
  return (
    <AdminGuard>
      <div className="grid md:grid-cols-2 gap-10">
        <CategoryPanel table="service" title="Service categories" />
        <CategoryPanel table="product" title="Product categories" />
      </div>
    </AdminGuard>
  );
}
