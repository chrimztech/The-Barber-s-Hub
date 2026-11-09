import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SiteLayout } from "@/components/site/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { api, API_URL, errorMessage } from "@/lib/api/client";
import { useAuth } from "@/hooks/useAuth";
import { RouteError } from "@/components/site/RouteError";
import { toast } from "sonner";

export const Route = createFileRoute("/auth/")({
  head: () => ({ meta: [{ title: "Sign in — Deepcuts Hair Studio" }] }),
  component: Auth,
  errorComponent: RouteError,
});

function Auth() {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  // The Google button only shows when the API has Google sign-in configured.
  const providers = useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api.get<{ google: boolean }>("/auth/providers"),
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (user) navigate({ to: "/account" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "forgot") {
      const parsed = z.object({ email: z.string().email().max(160) }).safeParse({ email });
      if (!parsed.success) {
        toast.error(parsed.error.issues[0].message);
        return;
      }
      setLoading(true);
      try {
        await api.post("/auth/forgot-password", { email });
        toast.success("Check your email for a password reset link.");
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setLoading(false);
      }
      return;
    }
    const parsed = z
      .object({
        email: z.string().email("Enter a valid email").max(160),
        password:
          mode === "signup"
            ? z.string().min(8, "Password must be at least 8 characters").max(72)
            : z.string().min(1, "Enter your password").max(200),
      })
      .safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (mode === "signup") {
      if (!fullName.trim()) {
        toast.error("Enter your full name");
        return;
      }
      if (!phone.trim()) {
        toast.error("Enter your phone number");
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords don't match");
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await signUp({ email, password, full_name: fullName.trim(), phone: phone.trim() });
        toast.success("Account created!");
      } else {
        await signIn(email, password);
        toast.success("Welcome back");
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SiteLayout>
      <section className="container-x py-20 max-w-md">
        <h1 className="font-display text-4xl">
          {mode === "signin"
            ? "Welcome back"
            : mode === "signup"
              ? "Create account"
              : "Reset password"}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          {mode === "signin"
            ? "Sign in to manage bookings and orders."
            : mode === "signup"
              ? "Join Deepcuts Hair Studio."
              : "We'll email you a link to reset your password."}
        </p>
        {mode !== "forgot" && providers.data?.google && (
          <>
            <Button asChild variant="outline" className="w-full mt-6">
              <a href={`${API_URL}/api/auth/google?redirect=/account`}>Continue with Google</a>
            </Button>
            <div className="flex items-center gap-3 mt-6">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </>
        )}
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div>
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <Label>Phone</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "forgot" && (
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}
          {mode === "signup" && (
            <div>
              <Label>Confirm password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          )}
          {mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("forgot")}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading
              ? "…"
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send reset link"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          {mode === "forgot" ? (
            <button onClick={() => setMode("signin")} className="text-primary hover:underline">
              Back to sign in
            </button>
          ) : (
            <>
              {mode === "signin" ? "New here?" : "Have an account?"}{" "}
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="text-primary hover:underline"
              >
                {mode === "signin" ? "Create account" : "Sign in"}
              </button>
            </>
          )}
        </p>
      </section>
    </SiteLayout>
  );
}
