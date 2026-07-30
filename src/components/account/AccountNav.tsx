import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, MessageSquareText, UserRound } from "lucide-react";

const links = [
  { to: "/account", label: "Overview", icon: LayoutDashboard },
  { to: "/account/profile", label: "Profile", icon: UserRound },
  { to: "/account/reviews", label: "My reviews", icon: MessageSquareText },
];

export function AccountNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav
      className="mb-8 flex gap-1 overflow-x-auto border-b border-border"
      aria-label="Account navigation"
    >
      {links.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition ${
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
