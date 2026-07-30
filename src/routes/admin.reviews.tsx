import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { AdminEmptyState, AdminPageHeader, StatusBadge } from "@/components/admin/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews - Admin" }] }),
  component: AdminReviews,
});

function AdminReviews() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const reviews = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, products(name), services(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (reviews.data ?? []).filter((review) => {
      const productName = (review.products as { name?: string } | null)?.name ?? "";
      const serviceName = (review.services as { name?: string } | null)?.name ?? "";
      const matches =
        !needle ||
        review.comment?.toLowerCase().includes(needle) ||
        productName.toLowerCase().includes(needle) ||
        serviceName.toLowerCase().includes(needle);
      return matches && (status === "all" || review.status === status);
    });
  }, [query, reviews.data, status]);

  const setReviewStatus = async (id: string, nextStatus: string) => {
    const { error } = await supabase.from("reviews").update({ status: nextStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(nextStatus === "approved" ? "Review published" : "Review rejected");
    reviews.refetch();
  };

  const remove = async (id: string) => {
    if (!confirm("Permanently delete this review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review deleted");
    reviews.refetch();
  };

  return (
    <AdminGuard>
      <AdminPageHeader
        title="Reviews"
        description="Moderate product and service feedback before it appears publicly."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="relative">
          <span className="sr-only">Search reviews</span>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search reviews or items"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-border bg-input px-3 text-sm"
          aria-label="Filter reviews by status"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {reviews.isLoading ? (
        <div className="border border-border/60 p-8 text-sm text-muted-foreground">
          Loading reviews...
        </div>
      ) : reviews.isError ? (
        <AdminEmptyState>
          Reviews could not be loaded. Refresh the page to try again.
        </AdminEmptyState>
      ) : filtered.length === 0 ? (
        <AdminEmptyState>No reviews match the current filters.</AdminEmptyState>
      ) : (
        <div className="border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="hidden md:table-cell">Item</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((review) => {
                const item =
                  (review.products as { name?: string } | null)?.name ??
                  (review.services as { name?: string } | null)?.name ??
                  "Removed item";
                return (
                  <TableRow key={review.id}>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Star className="h-4 w-4 fill-current" /> {review.rating}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="line-clamp-2">{review.comment || "No written comment"}</p>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{item}</TableCell>
                    <TableCell>
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setReviewStatus(review.id, "approved")}
                          title="Approve review"
                        >
                          <Check className="h-4 w-4 text-emerald-400" />
                          <span className="sr-only">Approve</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setReviewStatus(review.id, "rejected")}
                          title="Reject review"
                        >
                          <X className="h-4 w-4 text-amber-400" />
                          <span className="sr-only">Reject</span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(review.id)}
                          title="Delete review"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminGuard>
  );
}
