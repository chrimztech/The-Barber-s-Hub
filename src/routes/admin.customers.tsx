import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ban, Eye, KeyRound, Search, ShieldCheck, UserCheck, UserRound } from "lucide-react";
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
import { api, errorMessage } from "@/lib/api/client";
import type { AdminCustomer } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers - Admin" }] }),
  component: AdminCustomers,
});

type Profile = AdminCustomer;

function AdminCustomers() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [form, setForm] = useState({ full_name: "", phone: "", status: "active", isAdmin: false });
  const [saving, setSaving] = useState(false);

  const profiles = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => api.get<Profile[]>("/admin/customers"),
  });
  // Roles and activity counts come back on each customer row.
  const roles = { isLoading: false, isError: false };

  const adminIds = useMemo(
    () => new Set((profiles.data ?? []).filter((p) => p.isAdmin).map((p) => p.id)),
    [profiles.data],
  );

  const activityByUser = useMemo(
    () =>
      new Map(
        (profiles.data ?? []).map((p) => [
          p.id,
          { bookings: p.booking_count, orders: p.order_count },
        ]),
      ),
    [profiles.data],
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
    try {
      await api.patch(`/admin/customers/${selected.id}`, {
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
        isAdmin: form.isAdmin,
      });
    } catch (error) {
      setSaving(false);
      return toast.error(errorMessage(error));
    }
    setSaving(false);
    toast.success("Customer updated");
    setSelected(null);
    profiles.refetch();
  };

  const toggleStatus = async (profile: Profile) => {
    if (profile.id === user?.id) {
      toast.error("You cannot suspend your own account");
      return;
    }
    const nextStatus = profile.status === "active" ? "suspended" : "active";
    try {
      await api.patch(`/admin/customers/${profile.id}`, { status: nextStatus });
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success(nextStatus === "active" ? "Customer reactivated" : "Customer suspended");
    profiles.refetch();
  };

  const sendPasswordReset = async (profile: Profile) => {
    if (!profile.email) {
      toast.error("This customer has no email on file");
      return;
    }
    try {
      await api.post(`/admin/customers/${profile.id}/password-reset`);
    } catch (error) {
      return toast.error(errorMessage(error));
    }
    toast.success(`Password reset link sent to ${profile.email}`);
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
                <TableHead className="hidden lg:table-cell">Activity</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28">
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
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {activityByUser.get(profile.id)?.bookings ?? 0} bookings ·{" "}
                    {activityByUser.get(profile.id)?.orders ?? 0} orders
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
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openProfile(profile)}
                        title="Manage customer"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Manage customer</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => sendPasswordReset(profile)}
                        title="Send password reset email"
                      >
                        <KeyRound className="h-4 w-4" />
                        <span className="sr-only">Send password reset email</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(profile)}
                        disabled={profile.id === user?.id}
                        title={
                          profile.status === "active" ? "Suspend customer" : "Reactivate customer"
                        }
                      >
                        {profile.status === "active" ? (
                          <Ban className="h-4 w-4 text-destructive" />
                        ) : (
                          <UserCheck className="h-4 w-4 text-emerald-500" />
                        )}
                        <span className="sr-only">
                          {profile.status === "active" ? "Suspend customer" : "Reactivate customer"}
                        </span>
                      </Button>
                    </div>
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
