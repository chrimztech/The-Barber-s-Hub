import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { RouteError } from "@/components/site/RouteError";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart — Deepcuts Hair Studio" },
      { name: "description", content: "Your shopping cart." },
    ],
  }),
  component: CartPage,
  errorComponent: RouteError,
});

function CartPage() {
  const { items, setQty, remove, subtotal } = useCart();
  const { commerce } = useSiteSettings();
  const navigate = useNavigate();
  return (
    <SiteLayout>
      <section className="container-x pt-16 pb-24 max-w-4xl">
        <h1 className="font-display text-5xl">Your cart</h1>
        {items.length === 0 ? (
          <div className="mt-10 border border-border/60 p-16 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/shop">
              <Button className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                Shop equipment
              </Button>
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid lg:grid-cols-[1fr_320px] gap-10">
            <div className="space-y-4">
              {items.map((i) => (
                <div key={i.id} className="flex gap-4 border border-border/60 p-4">
                  <div className="h-20 w-20 bg-muted overflow-hidden flex-shrink-0">
                    {i.image_url && (
                      <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display">{i.name}</h3>
                    <div className="text-sm text-primary">
                      {formatCurrency(i.price, commerce.currency)}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => setQty(i.id, i.quantity - 1)}
                        aria-label={`Decrease quantity of ${i.name}`}
                        className="p-1 border border-border rounded hover:border-primary"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-8 text-center text-sm">{i.quantity}</span>
                      <button
                        onClick={() => setQty(i.id, i.quantity + 1)}
                        aria-label={`Increase quantity of ${i.name}`}
                        className="p-1 border border-border rounded hover:border-primary"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => remove(i.id)}
                        aria-label={`Remove ${i.name} from cart`}
                        className="ml-auto p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold">
                    {formatCurrency(i.price * i.quantity, commerce.currency)}
                  </div>
                </div>
              ))}
            </div>
            <aside className="border border-border/60 p-6 h-fit">
              <h3 className="font-display text-xl">Order summary</h3>
              <div className="flex justify-between mt-4 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal, commerce.currency)}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Delivery is calculated at checkout.
              </p>
              <Button
                onClick={() => navigate({ to: "/checkout" })}
                className="w-full mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Checkout
              </Button>
            </aside>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
