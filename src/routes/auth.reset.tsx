import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api, errorMessage } from "@/lib/api/client";
import type { AuthResponse } from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/reset")({
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({ meta: [{ title: "Reset password — Deepcuts Hair Studio" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const { acceptSession } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const parsed = z
      .object({ password: z.string().min(8, "Password must be at least 8 characters").max(72) })
      .safeParse({ password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    try {
      const session = await api.post<AuthResponse>("/auth/reset-password", { token, password });
      acceptSession(session);
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/account" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container-x py-20 max-w-md">
        <h1 className="font-display text-4xl">Choose a new password</h1>
        {!token ? (
          <p className="text-muted-foreground mt-4 text-sm">
            This page needs the link from your password reset email.{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Request a new link
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="text-muted-foreground mt-2 text-sm">
              Followed the reset link from your email? Set a new password below.
            </p>
            <form onSubmit={submit} className="space-y-4 mt-6">
              <div>
                <Label>New password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {loading ? "…" : "Update password"}
              </Button>
            </form>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
