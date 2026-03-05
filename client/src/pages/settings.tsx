import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSiteSettings, updateSiteSetting, fetchFeatureFlags, updateFeatureFlag } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Flag, Mail, Users, Download, Trash2, CheckCircle, Clock, Globe, AlertTriangle, ShieldAlert, RotateCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";

export default function AdminSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Pre-launch reset state
  const [resetScope, setResetScope] = useState({
    bookings: true, payments: true, holds: true,
    users: false, newsletter: false, reviews: false, products: false,
  });
  const [keepProductIds, setKeepProductIds] = useState<string[]>([]);
  const [resetPhase, setResetPhase] = useState<"idle" | "confirm" | "typing" | "done">("idle");
  const [confirmText, setConfirmText] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const CONFIRM_PHRASE = "RESET DASHBOARD";

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSiteSettings,
  });

  // Initialize form data from settings
  useEffect(() => {
    if (settings.length > 0) {
      const newFormData: Record<string, string> = {};
      settings.forEach(s => {
        // Handle both simple strings and JSON objects (though we simple string inputs for now)
        const val = s.value;
        newFormData[s.key] = typeof val === 'string' ? val : JSON.stringify(val);
      });
      setFormData(prev => ({ ...prev, ...newFormData }));
    }
  }, [settings]);

  const { data: flags = [], isLoading: isFlagsLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
  });

  const { data: newsletterData, isLoading: isNewsletterLoading, refetch: refetchNewsletter } = useQuery({
    queryKey: ["admin-newsletter-subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/newsletter/subscribers", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subscribers");
      return res.json();
    },
  });

  const { data: allTours = [] } = useQuery<any[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products", { credentials: "include" });
      return res.json();
    },
  });

  const handleReset = async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setIsResetting(true);
    try {
      const body = {
        scope: resetScope,
        keepProductIds: resetScope.products ? keepProductIds : [],
      };
      const res = await apiRequest("POST", "/api/admin/reset", body);
      const result = await res.json();
      queryClient.invalidateQueries();
      setResetPhase("done");
      toast({
        title: "Dashboard reset complete",
        description: `Deleted: ${Object.entries(result.deleted ?? {}).map(([k, v]) => `${v} ${k}`).join(", ") || "nothing"}`,
      });
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
      setConfirmText("");
    }
  };

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSiteSetting(key, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast({ title: t("cms.updated"), description: "Setting saved successfully." });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to save setting.", variant: "destructive" });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ slug, enabled }: { slug: string; enabled: boolean }) => updateFeatureFlag(slug, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
      toast({ title: t("cms.updated"), description: "Feature flag updated." });
    },
    onError: () => {
      toast({ title: t("common.error"), description: "Failed to update feature flag.", variant: "destructive" });
    },
  });

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    updateMutation.mutate({ key, value: formData[key] || "" });
  };

  const SETTING_GROUPS = {
    contact: [
      { key: "contact_email", label: t("contact.email"), icon: "Mail" },
      { key: "contact_phone", label: t("contact.phone"), icon: "Phone" },
      { key: "contact_address", label: t("footer.address"), icon: "MapPin" },
    ],
    social: [
      { key: "social_facebook", label: "Facebook URL", icon: "Facebook" },
      { key: "social_instagram", label: "Instagram URL", icon: "Instagram" },
      { key: "whatsapp_number", label: "WhatsApp Number", icon: "MessageCircle" },
    ],
    banking: [
      { key: "bank_name", label: "Bank Name", placeholder: "e.g. ANZ Bank (Vanuatu) Ltd" },
      { key: "bank_account_name", label: "Account Name", placeholder: "e.g. Ace Tours & Transfers" },
      { key: "bank_account_number", label: "Account Number", placeholder: "e.g. 123-456-789" },
      { key: "bank_swift_code", label: "SWIFT / BIC Code", placeholder: "e.g. ANZBVUVU" },
      { key: "bank_branch_code", label: "Branch Code (optional)", placeholder: "e.g. 01" },
      { key: "bank_payment_deadline_hours", label: "Payment Deadline (hours)", placeholder: "e.g. 24" },
    ],
    email: [
      { key: "admin_email", label: "Admin Notification Email", placeholder: "email to receive booking notifications" },
      { key: "email_from_name", label: "From Name", placeholder: "e.g. Ace Tours & Transfers" },
      { key: "app_url", label: "Website URL", placeholder: "e.g. https://acetours.vu" },
    ],
  };

  if (isLoading || isFlagsLoading) {
    return (
      <DashboardLayout type="admin">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout type="admin">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("dashboard.settings")}</h1>
          <p className="text-sm text-muted-foreground">Manage general site configuration</p>
        </div>

        <Tabs defaultValue="contact">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="contact">{t("footer.contactInfo")}</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
            <TabsTrigger value="banking">Bank Transfer</TabsTrigger>
            <TabsTrigger value="email">Email Config</TabsTrigger>
            <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
            <TabsTrigger value="flags">Feature Flags</TabsTrigger>
            <TabsTrigger value="reset" className="text-destructive data-[state=active]:text-destructive">Pre-Launch Reset</TabsTrigger>
          </TabsList>

          <TabsContent value="contact" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("footer.contactInfo")}</CardTitle>
                <CardDescription>
                  Update the contact details displayed in the footer and contact page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.contact.map((item) => (
                  <div key={item.key} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <Input
                        id={item.key}
                        value={formData[item.key] || ""}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        placeholder={`Enter ${item.label.toLowerCase()}`}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(item.key)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Links</CardTitle>
                <CardDescription>
                  Manage social media profiles and integrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.social.map((item) => (
                  <div key={item.key} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <Input
                        id={item.key}
                        value={formData[item.key] || ""}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        placeholder={`Enter ${item.label.toLowerCase()}`}
                      />
                    </div>
                    <Button
                      onClick={() => handleSave(item.key)}
                      disabled={updateMutation.isPending}
                    >
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banking" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bank Transfer Details</CardTitle>
                <CardDescription>
                  These details are displayed on the payment confirmation page and emailed to customers who choose bank transfer. Keep them accurate.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.banking.map((item) => (
                  <div key={item.key} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <Input
                        id={item.key}
                        value={formData[item.key] || ""}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        placeholder={item.placeholder}
                      />
                    </div>
                    <Button onClick={() => handleSave(item.key)} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Configuration</CardTitle>
                <CardDescription>
                  Configure where admin booking notifications are sent. SMTP is configured via environment variables (GMAIL_USER, GMAIL_APP_PASSWORD).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SETTING_GROUPS.email.map((item) => (
                  <div key={item.key} className="flex gap-4 items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <Input
                        id={item.key}
                        value={formData[item.key] || ""}
                        onChange={(e) => handleChange(item.key, e.target.value)}
                        placeholder={item.placeholder}
                      />
                    </div>
                    <Button onClick={() => handleSave(item.key)} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="newsletter" className="mt-4">
            <div className="flex flex-col gap-4">
              {/* Enable/disable newsletter toggle */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Newsletter Settings</CardTitle>
                  <CardDescription>Control your subscriber list and newsletter feature visibility.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Newsletter feature flag toggle */}
                  {flags.filter((f: any) => f.slug === "newsletter").length > 0 ? (
                    flags.filter((f: any) => f.slug === "newsletter").map((flag: any) => (
                      <div key={flag.slug} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div>
                          <p className="text-sm font-semibold">Newsletter Enabled</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Show the newsletter signup form in the footer and site-wide. Disabling hides the form and stops new subscriptions.</p>
                        </div>
                        <Switch
                          checked={flag.enabled}
                          onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: flag.slug, enabled: checked })}
                          disabled={toggleFlagMutation.isPending}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                      <div>
                        <p className="text-sm font-semibold">Newsletter Enabled</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Add a <code className="text-xs bg-muted px-1 rounded">newsletter</code> feature flag in Feature Flags tab to control visibility.</p>
                      </div>
                      <Switch checked={true} disabled />
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Subscribers", value: newsletterData?.length ?? "—", icon: <Users className="h-4 w-4" />, color: "text-blue-500" },
                      { label: "Confirmed", value: newsletterData?.filter((s: any) => s.confirmed).length ?? "—", icon: <CheckCircle className="h-4 w-4" />, color: "text-green-500" },
                      { label: "Unconfirmed", value: newsletterData?.filter((s: any) => !s.confirmed && !s.unsubscribedAt).length ?? "—", icon: <Clock className="h-4 w-4" />, color: "text-yellow-500" },
                      { label: "Unsubscribed", value: newsletterData?.filter((s: any) => s.unsubscribedAt).length ?? "—", icon: <Trash2 className="h-4 w-4" />, color: "text-red-500" },
                    ].map(stat => (
                      <div key={stat.label} className="p-3 rounded-lg border border-border bg-card text-center">
                        <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                        <div className="text-xl font-bold">{isNewsletterLoading ? "…" : stat.value}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Export button */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Download subscriber list as CSV for use in email platforms.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!newsletterData?.length) return;
                        const rows = [
                          ["Email", "Name", "Locale", "Source", "Confirmed", "Subscribed At", "Unsubscribed At"],
                          ...newsletterData.map((s: any) => [
                            s.email, s.name ?? "", s.locale ?? "en", s.source ?? "website",
                            s.confirmed ? "yes" : "no",
                            s.subscribedAt ? new Date(s.subscribedAt).toLocaleDateString() : "",
                            s.unsubscribedAt ? new Date(s.unsubscribedAt).toLocaleDateString() : "",
                          ])
                        ];
                        const csv = rows.map(r => r.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url;
                        a.download = `subscribers-${new Date().toISOString().split("T")[0]}.csv`;
                        a.click(); URL.revokeObjectURL(url);
                      }}
                      disabled={!newsletterData?.length}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Subscribers table */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" />Subscribers</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isNewsletterLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                  ) : !newsletterData?.length ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Mail className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No subscribers yet. The newsletter signup form will collect emails automatically.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Source</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Locale</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Joined</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {newsletterData.map((sub: any) => (
                            <tr key={sub.id} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-4 font-medium text-foreground">{sub.email}</td>
                              <td className="py-2.5 px-4 text-muted-foreground">{sub.name ?? "—"}</td>
                              <td className="py-2.5 px-4">
                                <span className="px-2 py-0.5 rounded-full text-xs bg-muted border border-border">{sub.source ?? "website"}</span>
                              </td>
                              <td className="py-2.5 px-4 hidden sm:table-cell">
                                <span className="flex items-center gap-1 text-muted-foreground"><Globe className="h-3 w-3" />{sub.locale ?? "en"}</span>
                              </td>
                              <td className="py-2.5 px-4">
                                {sub.unsubscribedAt ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-500 border border-red-500/20">Unsubscribed</span>
                                ) : sub.confirmed ? (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-600 border border-green-500/20">Confirmed</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">Pending</span>
                                )}
                              </td>
                              <td className="py-2.5 px-4 text-muted-foreground hidden md:table-cell text-xs">
                                {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="flags" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Feature Flags</CardTitle>
                <CardDescription>
                  Enable or disable system features. Disabled features will be hidden from the public UI.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {flags.map((flag: any) => (
                  <div key={flag.slug} className="flex items-center justify-between space-x-2">
                    <div className="flex flex-col space-y-1">
                      <Label htmlFor={flag.slug} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {flag.displayName}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {flag.description}
                      </p>
                    </div>
                    <Switch
                      id={flag.slug}
                      checked={flag.enabled}
                      onCheckedChange={(checked) => toggleFlagMutation.mutate({ slug: flag.slug, enabled: checked })}
                      disabled={toggleFlagMutation.isPending}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PRE-LAUNCH RESET ── */}
          <TabsContent value="reset" className="mt-4">
            <div className="flex flex-col gap-4">
              {/* Warning banner */}
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <ShieldAlert className="h-5 w-5" />
                    Pre-Launch Dashboard Reset
                  </CardTitle>
                  <CardDescription>
                    Use this to wipe test data before going live. Choose exactly what to delete below.
                    Admin accounts and site settings are <strong>always preserved</strong>.
                    This action is irreversible.
                  </CardDescription>
                </CardHeader>
              </Card>

              {resetPhase === "done" ? (
                <Card className="border-green-500/40 bg-green-500/5">
                  <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                    <p className="font-semibold text-lg">Reset complete</p>
                    <p className="text-sm text-muted-foreground">The selected data has been permanently erased. Your settings and admin account are intact.</p>
                    <Button variant="outline" onClick={() => { setResetPhase("idle"); setResetScope({ bookings: true, payments: true, holds: true, users: false, newsletter: false, reviews: false, products: false }); setKeepProductIds([]); }}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Run another reset
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Step 1 — scope selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Step 1 — Choose what to delete</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {([
                        { key: "holds", label: "Availability Holds", desc: "Clears all temporary seat holds and capacity audit log." },
                        { key: "bookings", label: "Bookings & Booking Items", desc: "All booking records including passenger manifests." },
                        { key: "payments", label: "Payment Records", desc: "All payment attempts, gateway responses, and reconciliation data." },
                        { key: "reviews", label: "Reviews", desc: "All guest reviews and moderation data." },
                        { key: "newsletter", label: "Newsletter Subscribers", desc: "Clears the entire subscriber list." },
                        { key: "users", label: "Non-Admin Users", desc: "Deletes all customer accounts (admin account is always kept)." },
                        { key: "products", label: "Products (Tours / Transfers / Vehicles)", desc: "Deletes product listings. Select which ones to KEEP below." },
                      ] as const).map(item => (
                        <div key={item.key} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                          <Checkbox
                            id={`scope-${item.key}`}
                            checked={resetScope[item.key as keyof typeof resetScope]}
                            onCheckedChange={(checked) => setResetScope(prev => ({ ...prev, [item.key]: !!checked }))}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <label htmlFor={`scope-${item.key}`} className="text-sm font-semibold cursor-pointer">{item.label}</label>
                            <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                          </div>
                          {(item.key === "bookings" || item.key === "payments") && (
                            <Badge variant="outline" className="text-xs shrink-0">Recommended</Badge>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Products sub-section: which to keep */}
                  {resetScope.products && allTours.length > 0 && (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Step 1b — Select products to KEEP
                        </CardTitle>
                        <CardDescription>
                          All unchecked products will be permanently deleted, along with all their bookings and schedule data.
                          Check the ones you want to carry over into production.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {allTours.map((tour: any) => (
                            <div key={tour.id} className="flex items-center gap-2.5 p-2 rounded border border-border bg-background">
                              <Checkbox
                                id={`keep-${tour.id}`}
                                checked={keepProductIds.includes(tour.id)}
                                onCheckedChange={(checked) =>
                                  setKeepProductIds(prev =>
                                    checked ? [...prev, tour.id] : prev.filter(id => id !== tour.id)
                                  )
                                }
                              />
                              <label htmlFor={`keep-${tour.id}`} className="flex-1 text-sm cursor-pointer leading-tight">
                                <span className="font-medium">{tour.title}</span>
                                <span className="ml-1.5 text-xs text-muted-foreground capitalize">({tour.category})</span>
                              </label>
                            </div>
                          ))}
                        </div>
                        {keepProductIds.length > 0 && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-3 font-medium">
                            ✓ Keeping {keepProductIds.length} product{keepProductIds.length > 1 ? "s" : ""} — deleting {allTours.length - keepProductIds.length}
                          </p>
                        )}
                        {keepProductIds.length === 0 && (
                          <p className="text-xs text-destructive mt-3 font-medium">⚠ All {allTours.length} products will be deleted</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Step 2 — summary + confirm */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Step 2 — Confirm and execute</CardTitle>
                      <CardDescription>
                        Review what will be deleted, then type <code className="bg-muted px-1 rounded text-destructive font-mono text-xs">{CONFIRM_PHRASE}</code> to proceed.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Summary */}
                      <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-1 text-sm">
                        <p className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Will be deleted:</p>
                        {Object.entries(resetScope).filter(([, v]) => v).map(([k]) => (
                          <div key={k} className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-3 w-3 shrink-0" />
                            <span className="capitalize">{k === "holds" ? "Availability holds & audit log" : k === "products" ? `Products (${allTours.length - keepProductIds.length} of ${allTours.length})` : k}</span>
                          </div>
                        ))}
                        {Object.values(resetScope).every(v => !v) && (
                          <p className="text-muted-foreground italic text-xs">Nothing selected — nothing will be deleted.</p>
                        )}
                        <hr className="border-border my-2" />
                        <p className="text-green-600 dark:text-green-400 text-xs font-medium">✓ Admin accounts, settings, feature flags, and payment gateway config are always preserved.</p>
                      </div>

                      {/* Confirmation input */}
                      <div className="space-y-2">
                        <Label htmlFor="confirm-reset" className="text-sm">
                          Type <strong>{CONFIRM_PHRASE}</strong> to confirm:
                        </Label>
                        <Input
                          id="confirm-reset"
                          placeholder={CONFIRM_PHRASE}
                          value={confirmText}
                          onChange={e => setConfirmText(e.target.value)}
                          className={confirmText && confirmText !== CONFIRM_PHRASE ? "border-destructive" : ""}
                        />
                      </div>

                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={confirmText !== CONFIRM_PHRASE || isResetting || Object.values(resetScope).every(v => !v)}
                        onClick={handleReset}
                      >
                        {isResetting
                          ? <><Loader2 className="animate-spin h-4 w-4 mr-2" /> Resetting…</>
                          : <><ShieldAlert className="h-4 w-4 mr-2" /> Execute Reset</>
                        }
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
