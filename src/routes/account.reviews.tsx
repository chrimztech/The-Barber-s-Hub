import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AccountNav } from "@/components/account/AccountNav";
import { StatusBadge } from "@/components/admin/AdminUi";
import { SiteLayout } from "@/components/site/Layout";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/account/reviews")({
  head: () => ({ meta: [{ title: "My Reviews - Deepcuts Hair Studio" }] }),
  component: AccountReviews,
  errorComponent: RouteError,
});

function AccountReviews() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const reviews = useQuery({
    enabled: !!user,
    queryKey: ["my-reviews", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, products(name), services(name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review deleted");
    reviews.refetch();
  };

  if (loading || !user) {
    return (
      <SiteLayout>
        <div className="container-x py-16 text-sm text-muted-foreground">Loading reviews...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="container-x max-w-5xl py-16">
        <p className="mb-2 text-xs uppercase tracking-[0.4em] text-primary">Account</p>
        <h1 className="mb-6 font-display text-4xl">My reviews</h1>
        <AccountNav />

        {reviews.isLoading ? (
          <div className="border border-border/60 p-8 text-sm text-muted-foreground">
            Loading reviews...
          </div>
        ) : reviews.isError ? (
          <div className="border border-dashed border-border p-8 text-sm text-muted-foreground">
            Reviews could not be loaded.
          </div>
        ) : (reviews.data ?? []).length === 0 ? (
          <div className="border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            You have not submitted any reviews.
          </div>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {reviews.data!.map((review) => {
              const item =
                (review.products as { name?: string } | null)?.name ??
                (review.services as { name?: string } | null)?.name ??
                "Removed item";
              return (
                <article
                  key={review.id}
                  className="flex flex-wrap items-start justify-between gap-5 py-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-medium">{item}</h2>
                      <StatusBadge status={review.status} />
                    </div>
                    <div
                      className="mt-2 flex gap-0.5 text-primary"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={`h-4 w-4 ${index < review.rating ? "fill-current" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{review.comment}</p>
                    <time className="mt-2 block text-xs text-muted-foreground">
                      {formatDate(review.created_at)}
                    </time>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(review.id)}
                    title="Delete review"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">Delete review</span>
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
