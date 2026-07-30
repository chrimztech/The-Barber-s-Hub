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
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/barbers")({
  head: () => ({ meta: [{ title: "Manage Barbers — Admin" }] }),
  component: AdminBarbers,
});

type Barber = {
  id?: string;
  name: string;
  specialty: string;
  bio: string;
  phone: string;
  photo_url: string | null;
  status: string;
};
const empty: Barber = {
  name: "",
  specialty: "",
  bio: "",
  phone: "",
  photo_url: null,
  status: "active",
};

function AdminBarbers() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Barber>(empty);

  const list = useQuery({
    queryKey: ["admin-barbers"],
    queryFn: async () => (await supabase.from("barbers").select("*").order("name")).data ?? [],
  });

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const { error } = form.id
      ? await supabase.from("barbers").update(form).eq("id", form.id)
      : await supabase.from("barbers").insert(form);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false);
    list.refetch();
  };
  const remove = async (id: string) => {
    if (!confirm("Delete this barber?")) return;
    const { error } = await supabase.from("barbers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    list.refetch();
  };

  return (
    <AdminGuard>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-2xl">Barbers</h2>
        <Button
          onClick={() => {
            setForm(empty);
            setOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" /> New barber
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(list.data ?? []).map((b) => (
          <div key={b.id} className="border border-border/60 overflow-hidden flex flex-col">
            {b.photo_url ? (
              <img src={b.photo_url} alt={b.name} className="aspect-square object-cover" />
            ) : (
              <div className="aspect-square bg-muted/40" />
            )}
            <div className="p-4 flex-1 flex flex-col gap-2">
              <h3 className="font-display text-lg">{b.name}</h3>
              {b.specialty && (
                <div className="text-primary text-xs uppercase tracking-widest">{b.specialty}</div>
              )}
              <p className="text-xs text-muted-foreground line-clamp-3">{b.bio}</p>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {b.status}
              </div>
              <div className="flex gap-2 mt-auto pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setForm({
                      id: b.id,
                      name: b.name,
                      specialty: b.specialty ?? "",
                      bio: b.bio ?? "",
                      phone: b.phone ?? "",
                      photo_url: b.photo_url,
                      status: b.status,
                    });
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => remove(b.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          </div>
        ))}
        {(list.data ?? []).length === 0 && (
          <div className="text-muted-foreground text-sm">No barbers yet.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit" : "New"} barber</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <ImageUpload
              value={form.photo_url}
              onChange={(url) => setForm({ ...form, photo_url: url })}
              folder="barbers"
              label="Photo"
            />
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Specialty</Label>
              <Input
                value={form.specialty}
                onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Bio</Label>
              <Textarea
                rows={3}
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
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
    </AdminGuard>
  );
}
