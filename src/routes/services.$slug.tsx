import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Clock, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { ReviewSection } from "@/components/site/ReviewSection";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/services/$slug")({
  head: () => ({ meta: [{ title: "Service - Deepcuts Hair Studio" }] }),
  component: ServiceDetail,
  errorComponent: RouteError,
});

function ServiceDetail() {
  const { slug } = Route.useParams();
  const { commerce } = useSiteSettings();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const service = useQuery({
    queryKey: ["service", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*, service_categories(name)")
        .eq("slug", slug)
        .eq("status", "active")
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (service.isLoading) {
    return (
      <SiteLayout>
        <div className="container-x py-24 text-sm text-muted-foreground">Loading service...</div>
      </SiteLayout>
    );
  }
  if (service.isError || !service.data) {
    return (
      <SiteLayout>
        <div className="container-x py-24 text-center">
          <h1 className="font-display text-4xl">Service unavailable</h1>
          <Link to="/services">
            <Button variant="outline" className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to services
            </Button>
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const item = service.data;
  const category = (item.service_categories as { name?: string } | null)?.name ?? "Barbering";
  const gallery = Array.isArray(item.gallery_images)
    ? item.gallery_images.filter((image): image is string => typeof image === "string")
    : [];
  const images = [item.image_url, ...gallery].filter(
    (image, index, list): image is string =>
      typeof image === "string" && list.indexOf(image) === index,
  );

  return (
    <SiteLayout>
      <main className="container-x pb-16 pt-8">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to services
        </Link>

        <section className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] lg:gap-16">
          <div>
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              {(selectedImage ?? item.image_url) ? (
                <img
                  src={selectedImage ?? item.image_url ?? ""}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No service image
                </div>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {images.map((image) => (
                  <button
                    key={image}
                    type="button"
                    className={`aspect-square overflow-hidden border ${
                      (selectedImage ?? item.image_url) === image
                        ? "border-primary"
                        : "border-border"
                    }`}
                    onClick={() => setSelectedImage(image)}
                    aria-label="View service image"
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="lg:py-4">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">{category}</p>
            <h1 className="mt-3 font-display text-4xl md:text-5xl">{item.name}</h1>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              {item.full_description || item.short_description}
            </p>

            <div className="mt-8 grid grid-cols-2 border-y border-border py-5">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" /> Duration
                </div>
                <div className="mt-2 font-display text-xl">{item.duration} minutes</div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> Price
                </div>
                <div className="mt-2 font-display text-xl text-primary">
                  {formatCurrency(item.price, commerce.currency)}
                </div>
              </div>
            </div>

            <Link to="/book" search={{ service: item.id }}>
              <Button
                size="lg"
                className="mt-8 w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CalendarDays className="mr-2 h-5 w-5" /> Book this service
              </Button>
            </Link>
          </div>
        </section>

        <ReviewSection target={{ type: "service", id: item.id }} />
      </main>
    </SiteLayout>
  );
}
