import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

type ReviewTarget = { type: "product"; id: string } | { type: "service"; id: string };

export function ReviewSection({ target }: { target: ReviewTarget }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const reviews = useQuery({
    queryKey: ["public-reviews", target.type, target.id],
    queryFn: async () => {
      let request = supabase
        .from("reviews")
        .select("id,rating,comment,created_at")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      request =
        target.type === "product"
          ? request.eq("product_id", target.id)
          : request.eq("service_id", target.id);
      const { data, error } = await request;
      if (error) throw error;
      return data;
    },
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (comment.trim().length < 3) return toast.error("Please add a short comment");
    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      user_id: user.id,
      rating,
      comment: comment.trim(),
      status: "pending",
      product_id: target.type === "product" ? target.id : null,
      service_id: target.type === "service" ? target.id : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setComment("");
    setRating(5);
    toast.success("Review submitted for approval");
  };

  const average = reviews.data?.length
    ? reviews.data.reduce((sum, review) => sum + review.rating, 0) / reviews.data.length
    : 0;

  return (
    <section className="border-t border-border py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Feedback</p>
          <h2 className="mt-2 font-display text-3xl">Customer reviews</h2>
        </div>
        {reviews.data && reviews.data.length > 0 && (
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-primary text-primary" />
            <span className="text-lg font-semibold">{average.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">({reviews.data.length})</span>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          {reviews.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading reviews...</p>
          ) : reviews.isError ? (
            <p className="text-sm text-muted-foreground">Reviews could not be loaded.</p>
          ) : (reviews.data ?? []).length === 0 ? (
            <div className="border border-dashed border-border p-8 text-sm text-muted-foreground">
              No published reviews yet.
            </div>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {reviews.data!.map((review) => (
                <article key={review.id} className="py-5">
                  <div className="flex items-center justify-between gap-4">
                    <div
                      className="flex gap-0.5 text-primary"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                          key={index}
                          className={`h-4 w-4 ${index < review.rating ? "fill-current" : "text-muted"}`}
                        />
                      ))}
                    </div>
                    <time className="text-xs text-muted-foreground">
                      {formatDate(review.created_at)}
                    </time>
                  </div>
                  <p className="mt-3 text-sm leading-6">{review.comment}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-xl">Leave a review</h3>
          {!user ? (
            <p className="mt-3 text-sm text-muted-foreground">
              <Link to="/auth" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to share your experience.
            </p>
          ) : (
            <form onSubmit={submit} className="mt-4">
              <div className="mb-4 flex gap-1" role="group" aria-label="Rating">
                {Array.from({ length: 5 }).map((_, index) => {
                  const value = index + 1;
                  return (
                    <button
                      key={value}
                      type="button"
                      className="p-1"
                      onClick={() => setRating(value)}
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                    >
                      <Star
                        className={`h-6 w-6 ${value <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
                      />
                    </button>
                  );
                })}
              </div>
              <Textarea
                rows={4}
                maxLength={500}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share your experience"
                aria-label="Review comment"
              />
              <Button
                type="submit"
                className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={saving}
              >
                {saving ? "Submitting..." : "Submit review"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
