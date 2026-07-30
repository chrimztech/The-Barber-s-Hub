import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/Layout";
import { ReviewSection } from "@/components/site/ReviewSection";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/shop/$slug")({
  head: () => ({ meta: [{ title: "Product - Deepcuts Hair Studio" }] }),
  component: ProductDetail,
  errorComponent: RouteError,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const { add, items } = useCart();
  const { commerce } = useSiteSettings();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("slug", slug)
        .eq("status", "active")
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (product.isLoading) {
    return (
      <SiteLayout>
        <div className="container-x py-24 text-sm text-muted-foreground">Loading product...</div>
      </SiteLayout>
    );
  }
  if (product.isError || !product.data) {
    return (
      <SiteLayout>
        <div className="container-x py-24 text-center">
          <h1 className="font-display text-4xl">Product unavailable</h1>
          <Link to="/shop">
            <Button variant="outline" className="mt-6">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to shop
            </Button>
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const item = product.data;
  const price = Number(item.discount_price ?? item.price);
  const inCart = items.find((cartItem) => cartItem.id === item.id)?.quantity ?? 0;
  const available = Math.max(0, item.stock_quantity - inCart);
  const category =
    (item.product_categories as { name?: string } | null)?.name ?? "Grooming equipment";
  const gallery = Array.isArray(item.gallery_images)
    ? item.gallery_images.filter((image): image is string => typeof image === "string")
    : [];
  const images = [item.image_url, ...gallery].filter(
    (image, index, list): image is string =>
      typeof image === "string" && list.indexOf(image) === index,
  );
  const specifications =
    item.specifications &&
    typeof item.specifications === "object" &&
    !Array.isArray(item.specifications)
      ? Object.entries(item.specifications)
      : [];

  const addToCart = () => {
    if (available <= 0) return toast.error("No more stock is available");
    const amount = Math.min(quantity, available);
    add({ id: item.id, name: item.name, price, image_url: item.image_url }, amount);
    toast.success(`${amount} added to cart`);
  };

  return (
    <SiteLayout>
      <main className="container-x pb-16 pt-8">
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to shop
        </Link>

        <section className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="aspect-square overflow-hidden bg-muted">
              {(selectedImage ?? item.image_url) ? (
                <img
                  src={selectedImage ?? item.image_url ?? ""}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No product image
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
                    aria-label="View product image"
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
            {item.brand && <p className="mt-2 text-sm text-muted-foreground">By {item.brand}</p>}

            <div className="mt-6 flex items-baseline gap-3">
              <span className="text-2xl font-semibold text-primary">
                {formatCurrency(price, commerce.currency)}
              </span>
              {item.discount_price && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(item.price, commerce.currency)}
                </span>
              )}
            </div>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              {item.full_description || item.short_description}
            </p>

            <div className="mt-8 border-y border-border py-5">
              <div className="flex flex-wrap items-center gap-4">
                <div
                  className="flex h-10 items-center border border-border"
                  aria-label="Quantity selector"
                >
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center hover:text-primary"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-sm">{quantity}</span>
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center hover:text-primary"
                    onClick={() => setQuantity(Math.min(Math.max(1, available), quantity + 1))}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  size="lg"
                  className="min-w-48 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={available <= 0}
                  onClick={addToCart}
                >
                  <ShoppingBag className="mr-2 h-4 w-4" />{" "}
                  {available <= 0 ? "Out of stock" : "Add to cart"}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {item.stock_quantity > 0
                  ? `${item.stock_quantity} in stock`
                  : "Currently unavailable"}
              </p>
            </div>

            <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex gap-3">
                <Truck className="h-5 w-5 text-primary" />
                <span>Delivery or studio pickup available</span>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span>Condition: {item.condition ?? "new"}</span>
              </div>
            </div>
          </div>
        </section>

        {specifications.length > 0 && (
          <section className="border-t border-border py-12">
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Product details</p>
            <h2 className="mt-2 font-display text-3xl">Specifications</h2>
            <dl className="mt-6 grid max-w-3xl sm:grid-cols-2">
              {specifications.map(([key, value]) => (
                <div
                  key={key}
                  className="grid grid-cols-[minmax(120px,0.7fr)_1fr] gap-4 border-b border-border py-3 text-sm"
                >
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd>{String(value ?? "")}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <ReviewSection target={{ type: "product", id: item.id }} />
      </main>
    </SiteLayout>
  );
}
