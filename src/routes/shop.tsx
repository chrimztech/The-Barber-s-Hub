import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { RouteError } from "@/components/site/RouteError";
import { toast } from "sonner";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — Deepcuts Hair Studio" },
      {
        name: "description",
        content: "Pro-grade barbing equipment, clippers, chairs, and accessories.",
      },
    ],
  }),
  component: Shop,
  errorComponent: RouteError,
});

function Shop() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [sort, setSort] = useState<"new" | "plh" | "phl">("new");

  const cats = useQuery({
    queryKey: ["pc"],
    queryFn: async () =>
      (await supabase.from("product_categories").select("*").eq("status", "active")).data ?? [],
  });
  const prods = useQuery({
    queryKey: ["products"],
    queryFn: async () =>
      (await supabase.from("products").select("*").eq("status", "active")).data ?? [],
  });
  const { add, items } = useCart();
  const { commerce } = useSiteSettings();

  const filtered = useMemo(() => {
    let list = prods.data ?? [];
    if (cat !== "all") list = list.filter((p) => p.category_id === cat);
    if (q.trim()) list = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (sort === "plh")
      list = [...list].sort(
        (a, b) => Number(a.discount_price ?? a.price) - Number(b.discount_price ?? b.price),
      );
    if (sort === "phl")
      list = [...list].sort(
        (a, b) => Number(b.discount_price ?? b.price) - Number(a.discount_price ?? a.price),
      );
    return list;
  }, [prods.data, q, cat, sort]);

  return (
    <SiteLayout>
      <section className="container-x pt-16 pb-8">
        <p className="text-primary text-xs tracking-[0.4em] uppercase mb-3">The Marketplace</p>
        <h1 className="font-display text-5xl md:text-6xl">Shop</h1>
      </section>
      <section className="container-x pb-24 grid lg:grid-cols-[240px_1fr] gap-10">
        <aside className="space-y-6">
          <label className="block">
            <span className="sr-only">Search products</span>
            <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Category</h4>
            <ul className="space-y-1.5 text-sm">
              <li>
                <button
                  aria-pressed={cat === "all"}
                  className={`hover:text-primary ${cat === "all" ? "text-primary" : ""}`}
                  onClick={() => setCat("all")}
                >
                  All products
                </button>
              </li>
              {(cats.data ?? []).map((c) => (
                <li key={c.id}>
                  <button
                    aria-pressed={cat === c.id}
                    className={`hover:text-primary ${cat === c.id ? "text-primary" : ""}`}
                    onClick={() => setCat(c.id)}
                  >
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-widest text-primary mb-3">Sort</h4>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "new" | "plh" | "phl")}
              className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="new">Newest</option>
              <option value="plh">Price · low → high</option>
              <option value="phl">Price · high → low</option>
            </select>
          </div>
        </aside>
        <div>
          {prods.isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="mt-3 h-4 bg-muted w-1/3" />
                  <div className="mt-2 h-5 bg-muted w-2/3" />
                </div>
              ))}
            </div>
          ) : prods.isError ? (
            <p className="text-muted-foreground">
              Couldn't load products right now. Please refresh.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => {
                const oos = p.stock_quantity <= 0;
                const inCart = items.find((i) => i.id === p.id)?.quantity ?? 0;
                const atLimit = inCart >= p.stock_quantity;
                return (
                  <div
                    key={p.id}
                    className="border border-border/60 bg-card group hover:border-primary/60 transition-colors"
                  >
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      <Link
                        to="/shop/$slug"
                        params={{ slug: p.slug }}
                        aria-label={`View ${p.name}`}
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                        )}
                      </Link>
                      {oos && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs uppercase tracking-widest text-primary">
                          Out of stock
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {p.brand}
                      </div>
                      <h3 className="font-display text-lg mt-1">
                        <Link
                          to="/shop/$slug"
                          params={{ slug: p.slug }}
                          className="hover:text-primary"
                        >
                          {p.name}
                        </Link>
                      </h3>
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
              {filtered.length === 0 && <p className="text-muted-foreground">No products match.</p>}
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
