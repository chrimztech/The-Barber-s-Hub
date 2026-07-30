import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const tones: Record<string, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  delivered: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  confirmed: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  processing: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  shipped: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  unread: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  cancelled: "border-red-500/40 bg-red-500/10 text-red-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-300",
  suspended: "border-red-500/40 bg-red-500/10 text-red-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
  inactive: "border-border bg-muted/50 text-muted-foreground",
  read: "border-border bg-muted/50 text-muted-foreground",
  replied: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  refunded: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-nowrap font-medium", tones[status] ?? tones.inactive)}
    >
      {titleCase(status)}
    </Badge>
  );
}

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
