import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export function RouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "route" });
  }, [error]);
  return (
    <SiteLayout>
      <section className="container-x py-24 max-w-md text-center">
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Try again
        </Button>
      </section>
    </SiteLayout>
  );
}
