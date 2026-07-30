import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RouteError } from "@/components/site/RouteError";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Deepcuts Hair Studio" },
      {
        name: "description",
        content:
          "Premium barbering services: cuts, beards, color, kids, styling, and home service.",
      },
    ],
  }),
  component: ServicesPage,
  errorComponent: RouteError,
});

function ServicesPage() {
  const { commerce } = useSiteSettings();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["services"],
    queryFn: async () =>
      (
        await supabase
          .from("services")
          .select("*, service_categories(name)")
          .eq("status", "active")
          .order("name")
      ).data ?? [],
  });
  return (
    <SiteLayout>
      <section className="container-x pt-16 pb-10">
        <p className="text-primary text-xs tracking-[0.4em] uppercase mb-3">The Chair</p>
        <h1 className="font-display text-5xl md:text-6xl">Services</h1>
        <p className="text-muted-foreground max-w-xl mt-4">
          Every service finishes with a hot-towel detail and a complimentary style consultation.
        </p>
      </section>
      <section className="container-x pb-24">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[16/10] bg-muted" />
                <div className="mt-3 h-5 bg-muted w-2/3" />
                <div className="mt-2 h-4 bg-muted w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <p className="text-muted-foreground">Couldn't load services right now. Please refresh.</p>
        ) : data!.length === 0 ? (
          <p className="text-muted-foreground">No services available yet — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data!.map((s) => (
              <div
                key={s.id}
                className="border border-border/60 bg-card group hover:border-primary/60 transition-colors"
              >
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="p-5">
                  <div className="text-[10px] uppercase tracking-widest text-primary">
                    {(s.service_categories as { name?: string } | null)?.name ?? "Service"}
                  </div>
                  <h3 className="font-display text-2xl mt-1">
                    <Link
                      to="/services/$slug"
                      params={{ slug: s.slug }}
                      className="hover:text-primary"
                    >
                      {s.name}
                    </Link>
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {s.short_description}
                  </p>
                  <div className="flex items-center justify-between mt-5">
                    <div className="text-sm">
                      <span className="text-primary font-semibold text-lg">
                        {formatCurrency(s.price, commerce.currency)}
                      </span>
                      <span className="text-muted-foreground"> · {s.duration} min</span>
                    </div>
                    <Link to="/book" search={{ service: s.id }}>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Book
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
