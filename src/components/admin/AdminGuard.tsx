import { useEffect, type ReactNode } from "react";
import { useNavigate, Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  FolderTree,
  Mail,
  Package,
  Scissors,
  Settings,
  ShoppingBag,
  Star,
  Users,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SiteLayout } from "@/components/site/Layout";

const TABS = [
  { to: "/admin", label: "Overview", icon: ChartNoAxesColumnIncreasing },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
  { to: "/admin/messages", label: "Enquiries", icon: Mail },
  { to: "/admin/services", label: "Services", icon: Scissors },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/barbers", label: "Barbers", icon: UserRound },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/auth" });
      else if (!isAdmin) navigate({ to: "/account" });
    }
  }, [user, isAdmin, loading, navigate]);

  if (!isAdmin) return null;

  return (
    <SiteLayout>
      <section className="container-x py-12">
        <p className="text-primary text-xs tracking-[0.4em] uppercase mb-2">Dashboard</p>
        <h1 className="font-display text-4xl mb-6">Admin</h1>
        <nav
          className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-border px-1"
          aria-label="Admin navigation"
        >
          {TABS.map((t) => {
            const active = pathname === t.to;
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={
                  "flex shrink-0 items-center gap-2 px-3 py-2.5 text-xs uppercase tracking-wider border-b-2 -mb-px transition " +
                  (active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </section>
    </SiteLayout>
  );
}
