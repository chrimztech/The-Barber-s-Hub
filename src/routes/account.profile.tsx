import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, UserX } from "lucide-react";
import { toast } from "sonner";
import { AccountNav } from "@/components/account/AccountNav";
import { SiteLayout } from "@/components/site/Layout";
import { RouteError } from "@/components/site/RouteError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { api, errorMessage } from "@/lib/api/client";
import type { AuthResponse, Profile } from "@/lib/api/types";

export const Route = createFileRoute("/account/profile")({
  head: () => ({ meta: [{ title: "Profile - Deepcuts Hair Studio" }] }),
  component: AccountProfile,
  errorComponent: RouteError,
});

function AccountProfile() {
  const { user, loading, signOut, refresh, acceptSession } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  const profile = useQuery({
    enabled: !!user,
    queryKey: ["my-profile", user?.id],
    queryFn: () => api.get<Profile | null>("/me/profile"),
  });

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    if (fullName.trim().length < 2) return toast.error("Enter your full name");
    setSavingProfile(true);
    try {
      await api.patch("/me/profile", { full_name: fullName.trim(), phone: phone.trim() || null });
    } catch (error) {
      setSavingProfile(false);
      return toast.error(errorMessage(error));
    }
    setSavingProfile(false);
    toast.success("Profile saved");
    profile.refetch();
    refresh();
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (user?.hasPassword && !currentPassword) return toast.error("Enter your current password");
    setSavingPassword(true);
    try {
      // Other devices are signed out; this one receives a fresh session.
      const session = await api.post<AuthResponse>("/auth/change-password", {
        password,
        current_password: currentPassword || undefined,
      });
      acceptSession(session);
    } catch (error) {
      setSavingPassword(false);
      return toast.error(errorMessage(error));
    }
    setSavingPassword(false);
    setPassword("");
    setCurrentPassword("");
    toast.success("Password updated. Other devices have been signed out.");
  };

  const deactivateAccount = async () => {
    if (!user) return;
    if (
      !confirm(
        "Deactivate your account? You'll be signed out and won't be able to book or order until an admin reactivates you.",
      )
    ) {
      return;
    }
    setDeactivating(true);
    try {
      await api.post("/me/deactivate");
    } catch (error) {
      setDeactivating(false);
      return toast.error(errorMessage(error));
    }
    await signOut();
    toast.success("Your account has been deactivated");
    navigate({ to: "/" });
  };

  if (loading || !user) {
    return (
      <SiteLayout>
        <div className="container-x py-16 text-sm text-muted-foreground">Loading profile...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="container-x max-w-5xl py-16">
        <p className="mb-2 text-xs uppercase tracking-[0.4em] text-primary">Account</p>
        <h1 className="mb-6 font-display text-4xl">Profile</h1>
        <AccountNav />

        <div className="grid gap-8 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="border border-border/60 p-6">
            <h2 className="font-display text-2xl">Personal details</h2>
            <div className="mt-5 grid gap-4">
              <div>
                <Label>Email</Label>
                <Input value={user.email ?? ""} disabled />
              </div>
              <div>
                <Label>Full name</Label>
                <Input value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                disabled={savingProfile}
                className="mt-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" /> {savingProfile ? "Saving..." : "Save profile"}
              </Button>
            </div>
          </form>

          <form onSubmit={changePassword} className="h-fit border border-border/60 p-6">
            <h2 className="font-display text-2xl">Security</h2>
            {user.hasPassword ? (
              <div className="mt-5">
                <Label>Current password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                You sign in with Google. Set a password to also sign in with your email.
              </p>
            )}
            <div className="mt-4">
              <Label>New password</Label>
              <Input
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={savingPassword || !password}
              className="mt-5"
            >
              {savingPassword ? "Updating..." : "Update password"}
            </Button>
          </form>
        </div>

        <div className="mt-8 border border-destructive/40 p-6">
          <h2 className="font-display text-2xl text-destructive">Danger zone</h2>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            Deactivating your account signs you out and blocks new bookings or orders until an admin
            reactivates you. Your existing history is kept.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={deactivating}
            onClick={deactivateAccount}
            className="mt-4 border-destructive/60 text-destructive hover:bg-destructive/10"
          >
            <UserX className="mr-2 h-4 w-4" />
            {deactivating ? "Deactivating..." : "Deactivate my account"}
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
