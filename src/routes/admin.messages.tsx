import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Mail, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/messages")({
  head: () => ({ meta: [{ title: "Enquiries - Admin" }] }),
  component: AdminMessages,
});

type Message = Tables<"contact_messages">;

function AdminMessages() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<Message | null>(null);
  const [messageStatus, setMessageStatus] = useState("unread");
  const [adminNote, setAdminNote] = useState("");

  const messages = useQuery({
    queryKey: ["admin-messages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_messages")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (messages.data ?? []).filter((message) => {
      const matches =
        !needle ||
        message.name.toLowerCase().includes(needle) ||
        message.subject.toLowerCase().includes(needle) ||
        message.message.toLowerCase().includes(needle) ||
        message.email?.toLowerCase().includes(needle);
      return matches && (status === "all" || message.status === status);
    });
  }, [messages.data, query, status]);

  const openMessage = async (message: Message) => {
    setSelected(message);
    setMessageStatus(message.status === "unread" ? "read" : message.status);
    setAdminNote(message.admin_note ?? "");
    if (message.status === "unread") {
      await supabase.from("contact_messages").update({ status: "read" }).eq("id", message.id);
      messages.refetch();
    }
  };

  const save = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("contact_messages")
      .update({ status: messageStatus, admin_note: adminNote.trim() || null })
      .eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Enquiry updated");
    setSelected(null);
    messages.refetch();
  };

  const remove = async () => {
    if (!selected || !confirm("Permanently delete this enquiry?")) return;
    const { error } = await supabase.from("contact_messages").delete().eq("id", selected.id);
    if (error) return toast.error(error.message);
    toast.success("Enquiry deleted");
    setSelected(null);
    messages.refetch();
  };

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Enquiries"
        description="Read and track messages submitted through the contact page."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="relative">
          <span className="sr-only">Search enquiries</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search sender, subject, or message"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-input px-3 text-sm"
          aria-label="Filter enquiries by status"
        >
          <option value="all">All statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="replied">Replied</option>
        </select>
      </div>

      {messages.isLoading ? (
        <div className="border border-border/60 p-8 text-sm text-muted-foreground">
          Loading enquiries...
        </div>
      ) : messages.isError ? (
        <AdminEmptyState>
          Enquiries could not be loaded. Apply the latest Supabase migration, then refresh.
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState>No enquiries match the current filters.</AdminEmptyState>
      ) : (
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sender</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">Received</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((message) => (
                <TableRow
                  key={message.id}
                  className={message.status === "unread" ? "bg-primary/[0.04]" : ""}
                >
                  <TableCell>
                    <div className="font-medium">{message.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {message.email || message.phone || "No return contact"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{message.subject}</div>
                    <p className="max-w-sm truncate text-xs text-muted-foreground">
                      {message.message}
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(message.created_at)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={message.status} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openMessage(message)}
                      title="Open enquiry"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Open enquiry</span>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{selected?.subject}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                <div>
                  <div className="font-medium">{selected.name}</div>
                  {selected.email && (
                    <a
                      href={`mailto:${selected.email}`}
                      className="block text-sm text-primary hover:underline"
                    >
                      {selected.email}
                    </a>
                  )}
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone}`}
                      className="block text-sm text-primary hover:underline"
                    >
                      {selected.phone}
                    </a>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(selected.created_at, { dateStyle: "medium", timeStyle: "short" })}
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6">{selected.message}</p>
              <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                <div>
                  <Label>Status</Label>
                  <select
                    className="mt-1.5 h-10 w-full rounded-md border border-border bg-input px-3 text-sm"
                    value={messageStatus}
                    onChange={(event) => setMessageStatus(event.target.value)}
                  >
                    <option value="unread">Unread</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                  </select>
                </div>
                <div>
                  <Label>Internal note</Label>
                  <Textarea
                    rows={3}
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="destructive" onClick={remove}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
            <div className="flex gap-2">
              {selected?.email && (
                <Button variant="outline" asChild>
                  <a
                    href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Reply
                  </a>
                </Button>
              )}
              <Button
                onClick={save}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
}
