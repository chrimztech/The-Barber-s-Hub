import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Scissors, Star, Truck, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import hero from "@/assets/hero-barbershop.jpg";
import { useCart } from "@/lib/cart";
import { RouteError } from "@/components/site/RouteError";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Deepcuts Hair Studio — The Smart Detailed Hairdresser" },
      {
        name: "description",
        content:
          "Book a premium chair or shop pro-grade grooming equipment. Crafted for the modern gentleman.",
      },
    ],
  }),
  component: Home,
  errorComponent: RouteError,
});

function Home() {
  const services = useQuery({
    queryKey: ["featured-services"],
    queryFn: async () =>
      (
        await supabase
          .from("services")
          .select("*")
          .eq("is_featured", true)
          .eq("status", "active")
          .limit(4)
      ).data ?? [],
  });
  const products = useQuery({
    queryKey: ["featured-products"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("*")
          .eq("is_featured", true)
          .eq("status", "active")
          .limit(4)
      ).data ?? [],
  });
  const { add, items } = useCart();
  const { commerce } = useSiteSettings();

  return (
    <SiteLayout>
      {/* HERO */}
      <section className="relative h-[82vh] min-h-[560px] overflow-hidden">
        <img
          src={hero}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-0 flex items-end pb-20">
          <div className="container-x">
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl text-balance text-foreground leading-[0.95] max-w-4xl">
              The art of the <span className="text-primary italic">cut.</span>
              <br />
              The craft of the gentleman.
            </h1>
            <p className="mt-6 max-w-xl text-muted-foreground text-lg">
              Premium barbering and a curated marketplace for the gear professionals trust.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/book">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Book a chair <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/shop">
                <Button size="lg" variant="outline" className="border-primary/40 text-foreground">
                  Shop equipment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="container-x py-20">
        <div className="grid md:grid-cols-4 gap-8">
          {[
            { Icon: Scissors, t: "Master Barbers", d: "12+ years average chair experience." },
            { Icon: Star, t: "Premium Products", d: "Brands the pros actually use." },
            { Icon: Truck, t: "Fast Delivery", d: "Equipment shipped nationwide." },
            { Icon: ShieldCheck, t: "Trusted Quality", d: "Hand-picked by master barbers." },
          ].map(({ Icon, t, d }) => (
            <div
              key={t}
              className="border border-border/60 p-6 hover:border-primary/60 transition-colors"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-xl">{t}</h3>
              <p className="text-sm text-muted-foreground mt-2">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="container-x py-16">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-primary text-xs tracking-[0.4em] uppercase mb-2">The Chair</p>
            <h2 className="font-display text-4xl md:text-5xl">Featured services</h2>
          </div>
          <Link to="/services" className="text-sm text-primary hover:underline hidden md:block">
            View all →
          </Link>
        </div>
        {services.isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] bg-muted" />
                <div className="mt-4 h-5 bg-muted w-3/4" />
                <div className="mt-2 h-4 bg-muted w-1/2" />
              </div>
            ))}
          </div>
        ) : services.isError ? (
          <p className="text-muted-foreground">Couldn't load services right now. Please refresh.</p>
        ) : services.data!.length === 0 ? (
          <p className="text-muted-foreground">No featured services yet — check back soon.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.data!.map((s) => (
              <Link key={s.id} to="/book" className="group block">
                <div className="aspect-[4/5] overflow-hidden bg-muted">
                  {s.image_url && (
                    <img
                      src={s.image_url}
                      alt={s.name}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="pt-4">
                  <h3 className="font-display text-xl group-hover:text-primary transition-colors">
                    {s.name}
                  </h3>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>{s.duration} min</span>
                    <span className="text-primary font-medium">
                      {formatCurrency(s.price, commerce.currency)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* PRODUCTS */}
      <section className="bg-card/40 py-20 mt-10">
        <div className="container-x">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-primary text-xs tracking-[0.4em] uppercase mb-2">
                The Marketplace
              </p>
              <h2 className="font-display text-4xl md:text-5xl">Pro gear, curated</h2>
            </div>
            <Link to="/shop" className="text-sm text-primary hover:underline hidden md:block">
              Shop all →
            </Link>
          </div>
          {products.isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="mt-3 h-4 bg-muted w-1/3" />
                  <div className="mt-2 h-5 bg-muted w-2/3" />
                </div>
              ))}
            </div>
          ) : products.isError ? (
            <p className="text-muted-foreground">
              Couldn't load products right now. Please refresh.
            </p>
          ) : products.data!.length === 0 ? (
            <p className="text-muted-foreground">No featured products yet — check back soon.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.data!.map((p) => {
                const oos = p.stock_quantity <= 0;
                const inCart = items.find((i) => i.id === p.id)?.quantity ?? 0;
                const atLimit = inCart >= p.stock_quantity;
                return (
                  <div
                    key={p.id}
                    className="group border border-border/60 bg-background hover:border-primary/60 transition-colors"
                  >
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      {p.image_url && (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      )}
                      {oos && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs uppercase tracking-widest text-primary">
                          Out of stock
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">
                        {p.brand}
                      </div>
                      <h3 className="font-display text-lg mt-1">{p.name}</h3>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          {p.discount_price ? (
                            <>
                              <span className="text-primary font-semibold">
                                {formatCurrency(p.discount_price, commerce.currency)}
                              </span>
                              <span className="text-xs text-muted-foreground line-through ml-2">
                                {formatCurrency(p.price, commerce.currency)}
                              </span>
                            </>
                          ) : (
                            <span className="text-primary font-semibold">
                              {formatCurrency(p.price, commerce.currency)}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={oos || atLimit}
                          onClick={() => {
                            if (atLimit) {
                              toast.error(`Only ${p.stock_quantity} in stock`);
                              return;
                            }
                            add({
                              id: p.id,
                              name: p.name,
                              price: Number(p.discount_price ?? p.price),
                              image_url: p.image_url,
                            });
                            toast.success("Added to cart");
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-24 text-center">
        <h2 className="font-display text-4xl md:text-6xl text-balance max-w-3xl mx-auto">
          Sharpen your <span className="text-primary italic">edge.</span>
        </h2>
        <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
          Reserve your chair, or stock your station with gear the pros trust.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/book">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Book appointment
            </Button>
          </Link>
          <Link to="/shop">
            <Button size="lg" variant="outline">
              Shop now
            </Button>
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
