import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { apiErrorMessage } from "@/lib/api-error";
import { Loader2 } from "lucide-react";

export default function CustomerProfile() {
  const { toast } = useToast();
  const { user, refresh } = useAuth();

  const [profile, setProfile] = useState({ name: "", email: "", phone: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({ name: user.name || "", email: user.email || "", phone: user.phone || "" });
  }, [user]);

  const initials = (profile.name || user?.name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!profile.name.trim()) {
      toast({ title: "Name required", description: "Enter your full name.", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }

    setSavingProfile(true);
    try {
      await apiRequest("PATCH", `/api/users/${user.id}/profile`, {
        name: profile.name.trim(),
        email: profile.email.trim(),
        phone: profile.phone.trim() || null,
      });
      await refresh();
      toast({ title: "Profile updated", description: "Your contact details have been saved." });
    } catch (error) {
      toast({ title: "Could not save profile", description: apiErrorMessage(error, "Please try again."), variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!currentPassword) {
      toast({ title: "Current password required", description: "Enter your current password.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Re-enter the new password.", variant: "destructive" });
      return;
    }

    setSavingPassword(true);
    try {
      await apiRequest("PATCH", `/api/users/${user.id}/change-password`, {
        currentPassword,
        newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password updated", description: "Your password has been changed." });
    } catch (error) {
      toast({ title: "Could not change password", description: apiErrorMessage(error, "Please try again."), variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <DashboardLayout type="customer">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile & Settings</h1>
          <p className="text-muted-foreground">Manage your personal information and account security.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your contact details. Your email is used for booking confirmations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl bg-muted">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{profile.name || "Your name"}</p>
                <p className="text-sm text-muted-foreground">{profile.email || "No email on file"}</p>
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <Input
                    id="profile-name"
                    autoComplete="name"
                    value={profile.name}
                    onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                    disabled={savingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-email">Email address</Label>
                  <Input
                    id="profile-email"
                    type="email"
                    autoComplete="email"
                    value={profile.email}
                    onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                    disabled={savingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-phone">Phone number</Label>
                  <Input
                    id="profile-phone"
                    type="tel"
                    autoComplete="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                    disabled={savingProfile}
                  />
                </div>
              </div>
              <Button type="submit" className="mt-4" disabled={savingProfile || !user}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and account access.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={changePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <PasswordInput
                  id="current-password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={savingPassword}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={savingPassword}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={savingPassword}
                  />
                </div>
              </div>
              <Button type="submit" variant="outline" className="mt-2" disabled={savingPassword || !user}>
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
