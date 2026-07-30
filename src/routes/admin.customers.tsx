import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Search, ShieldCheck, UserRound } from "lucide-react";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers - Admin" }] }),
  component: AdminCustomers,
});

type Profile = Tables<"profiles">;

function AdminCustomers() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", status: "active", isAdmin: false });
  const [saving, setSaving] = useState(false);

  const profiles = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const roles = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
  });

  const adminIds = useMemo(
    () =>
      new Set(
        (roles.data ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
      ),
    [roles.data],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (profiles.data ?? []).filter((profile) => {
      const matches =
        !needle ||
        profile.full_name?.toLowerCase().includes(needle) ||
        profile.email?.toLowerCase().includes(needle) ||
        profile.phone?.toLowerCase().includes(needle);
      return matches && (status === "all" || profile.status === status);
    });
  }, [profiles.data, query, status]);

  const openProfile = (profile: Profile) => {
    setSelected(profile);
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      status: profile.status,
      isAdmin: adminIds.has(profile.id),
    });
  };

  const save = async () => {
    if (!selected) return;
    if (selected.id === user?.id && !form.isAdmin) {
      toast.error("You cannot remove your own admin access");
      return;
    }
    setSaving(true);
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
      })
      .eq("id", selected.id);
    if (profileError) {
      setSaving(false);
      return toast.error(profileError.message);
    }

    const existingAdminRole = (roles.data ?? []).find(
      (role) => role.user_id === selected.id && role.role === "admin",
    );
    let roleError = null;
    if (form.isAdmin && !existingAdminRole) {
      ({ error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: selected.id, role: "admin" }));
    } else if (!form.isAdmin && existingAdminRole) {
      ({ error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("id", existingAdminRole.id));
    }

    setSaving(false);
    if (roleError) return toast.error(roleError.message);
    toast.success("Customer updated");
    setSelected(null);
    profiles.refetch();
    roles.refetch();
  };

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Customers"
        description="Manage customer records, account status, and staff access."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="relative">
          <span className="sr-only">Search customers</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, email, or phone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-input px-3 text-sm"
          aria-label="Filter customers by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {profiles.isLoading || roles.isLoading ? (
        <div className="border border-border/60 p-8 text-sm text-muted-foreground">
          Loading customers...
        </div>
      ) : profiles.isError || roles.isError ? (
        <AdminEmptyState>
          Customers could not be loaded. Refresh the page to try again.
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState>No customers match the current filters.</AdminEmptyState>
      ) : (
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="font-medium">{profile.full_name || "Unnamed customer"}</div>
                    <div className="text-xs text-muted-foreground">{profile.email}</div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{profile.phone || "-"}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {formatDate(profile.created_at)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {adminIds.has(profile.id) ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                      )}
                      {adminIds.has(profile.id) ? "Admin" : "Customer"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={profile.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openProfile(profile)}
                      title="Manage customer"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Manage customer</span>
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
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Customer details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid gap-4">
              <div>
                <Label>Email</Label>
                <Input value={selected.email ?? ""} disabled />
              </div>
              <div>
                <Label>Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                />
              </div>
              <div>
                <Label>Account status</Label>
                <select
                  className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
              <label className="flex items-start gap-3 border border-border/60 p-4 text-sm">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={form.isAdmin}
                  disabled={selected.id === user?.id}
                  onChange={(event) => setForm({ ...form, isAdmin: event.target.checked })}
                />
                <span>
                  <span className="block font-medium">Administrator access</span>
                  <span className="text-muted-foreground">
                    Can manage all dashboard data and user roles.
                  </span>
                </span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
