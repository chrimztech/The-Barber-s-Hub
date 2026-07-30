import { Link } from "@tanstack/react-router";
import { Menu, ShoppingBag, User as UserIcon, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

const nav = [
  { to: "/", label: "Home" },
  { to: "/services", label: "Services" },
  { to: "/shop", label: "Shop" },
  { to: "/book", label: "Book" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function Header() {
  const { user, isAdmin, signOut } = useAuth();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <img src="/savior_logo.jpg" alt="Deepcuts Hair Studio" className="h-10 w-10 rounded-full object-cover" />
          <span className="hidden whitespace-nowrap font-display text-base tracking-widest text-foreground sm:inline sm:text-xl">
            DEEPCUTS <span className="text-primary">HAIR STUDIO</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2 text-foreground md:ml-0">
          <Link
            to="/cart"
            aria-label={`Cart${count > 0 ? ` (${count} item${count === 1 ? "" : "s"})` : ""}`}
            className="relative p-2 hover:text-primary"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-4 px-1 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              {isAdmin && (
                <Link to="/admin">
                  <Button variant="outline" size="sm">
                    Admin
                  </Button>
                </Link>
              )}
              <Link to="/account">
                <Button variant="ghost" size="sm">
                  <UserIcon className="h-4 w-4 mr-1" />
                  Account
                </Button>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          ) : (
            <Link to="/auth" className="hidden md:block">
              <Button size="sm" variant="default">
                Sign in
              </Button>
            </Link>
          )}
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="container-x py-4 flex flex-col gap-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-wider text-muted-foreground"
              >
                {n.label}
              </Link>
            ))}
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="text-sm uppercase tracking-wider text-primary"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  to="/account"
                  onClick={() => setOpen(false)}
                  className="text-sm uppercase tracking-wider text-primary"
                >
                  Account
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    setOpen(false);
                  }}
                  className="text-left text-sm uppercase tracking-wider text-muted-foreground"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                to="/auth"
                onClick={() => setOpen(false)}
                className="text-sm uppercase tracking-wider text-primary"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
