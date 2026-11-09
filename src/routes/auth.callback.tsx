import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/Layout";
import { useAuth } from "@/hooks/useAuth";
import { setToken } from "@/lib/api/client";

/**
 * Landing page after Google sign-in. The API redirects here with the session token
 * (or an error) in the URL fragment, which never reaches any server log.
 */
export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in — Deepcuts Hair Studio" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    // Remove the token from the address bar and browser history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    const token = params.get("token");
    const failure = params.get("error");
    if (!token) {
      setError(failure ?? "Sign-in didn't complete. Please try again.");
      return;
    }
    setToken(token);
    refresh().then(() => {
      toast.success("Welcome!");
      const redirect = params.get("redirect");
      navigate({
        to: redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/account",
      });
    });
  }, [navigate, refresh]);

  return (
    <SiteLayout>
      <section className="container-x py-24 max-w-md text-center">
        {error ? (
          <>
            <h1 className="font-display text-3xl">Sign-in failed</h1>
            <p className="mt-3 text-sm text-muted-foreground">{error}</p>
            <Link to="/auth" className="mt-6 inline-block text-primary hover:underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        )}
      </section>
    </SiteLayout>
  );
}
