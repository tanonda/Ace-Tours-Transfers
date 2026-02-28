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
import { Loader2, Save, Flag, Mail, Users, Download, Trash2, CheckCircle, Clock, Globe } from "lucide-react";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";

function SettingItem({
  itemKey,
  label,
  value,
  placeholder,
  onChange,
  onSave
}: {
  itemKey: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onSave: () => Promise<void>;
}) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex gap-4 items-end">
      <div className="flex-1 space-y-2">
        <Label htmlFor={itemKey}>{label}</Label>
        <Input
          id={itemKey}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        />
      </div>
      <Button onClick={handleSaveClick} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function SettingList({
  itemKey,
  label,
  description,
  values,
  placeholder,
  onSave
}: {
  itemKey: string;
  label: string;
  description?: string;
  values: string[];
  placeholder?: string;
  onSave: (newValues: string[]) => Promise<void>;
}) {
  const [list, setList] = useState<string[]>(values);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setList(values);
  }, [values]);

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(list.filter(v => v.trim() !== ""));
    } finally {
      setIsSaving(false);
    }
  };

  const addRow = () => setList([...list, ""]);

  const updateRow = (index: number, val: string) => {
    const newList = [...list];
    newList[index] = val;
    setList(newList);
  };

  const removeRow = (index: number) => {
    const newList = list.filter((_, i) => i !== index);
    setList(newList);
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <Label className="text-base">{label}</Label>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <Button onClick={handleSaveClick} disabled={isSaving || list.every(v => v.trim() === '')} size="sm">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save List
        </Button>
      </div>

      <div className="space-y-2 mt-4">
        {list.map((val, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={val}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={placeholder || "Enter value..."}
              className="flex-1"
            />
            <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-2 text-center border border-dashed rounded-md">No items added yet.</p>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={addRow} className="mt-2 w-full text-muted-foreground hover:text-foreground">
        + Add New Item
      </Button>
    </div>
  );
}

export default function AdminSettings() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});

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
            {/* Newsletter moved to its own dedicated page: /admin/newsletter */}
            <TabsTrigger value="seo">SEO / GEO</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="flags">Feature Flags</TabsTrigger>
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
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
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
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={`Enter ${item.label.toLowerCase()}`}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}

                <div className="pt-4 mt-6 border-t">
                  <SettingList
                    itemKey="social_custom_links"
                    label="Additional Links"
                    description="Add any other custom links (e.g., TripAdvisor, YouTube). One URL per line."
                    placeholder="https://..."
                    values={formData["social_custom_links"] ? JSON.parse(formData["social_custom_links"]) : []}
                    onSave={async (newValues) => {
                      const valueString = JSON.stringify(newValues);
                      handleChange("social_custom_links", valueString);
                      await updateMutation.mutateAsync({ key: "social_custom_links", value: valueString });
                    }}
                  />
                </div>
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
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
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
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="newsletter-removed" className="mt-4">
            {/* Newsletter management has moved to its own dedicated page */}
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

          <TabsContent value="seo" className="mt-4 space-y-4">
            {/* H: SEO Control Surface */}
            <Card>
              <CardHeader>
                <CardTitle>SEO &amp; Metadata</CardTitle>
                <CardDescription>
                  Control page titles, meta descriptions, and Open Graph tags. Changes take effect on next page load.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "seo_site_name", label: "Site Name", placeholder: "Ace Tours & Transfers Vanuatu" },
                  { key: "seo_title_template", label: "Title Template", placeholder: "{page} | Ace Tours Vanuatu" },
                  { key: "seo_default_description", label: "Default Meta Description", placeholder: "Experience the best of Vanuatu with Ace Tours & Transfers..." },
                  { key: "seo_default_keywords", label: "Default Keywords", placeholder: "vanuatu tours, port vila transfers, efate island" },
                  { key: "seo_canonical_url", label: "Canonical URL Prefix", placeholder: "https://acetours.vu" },
                  { key: "seo_og_image", label: "Default OG Image URL", placeholder: "https://res.cloudinary.com/..." },
                ].map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Schema.org Markup</CardTitle>
                <CardDescription>
                  Structured data helps search engines and AI assistants understand your business. These settings are injected as JSON-LD.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: "schema_business_name", label: "Business Name", placeholder: "Ace Tours & Transfers" },
                  { key: "schema_business_type", label: "Business Type", placeholder: "TouristInformationCenter" },
                  { key: "schema_phone", label: "Business Phone", placeholder: "+678 12345" },
                  { key: "schema_address", label: "Street Address", placeholder: "Port Vila, Efate, Vanuatu" },
                  { key: "schema_price_range", label: "Price Range", placeholder: "$$" },
                ].map((item) => (
                  <SettingItem
                    key={item.key}
                    itemKey={item.key}
                    label={item.label}
                    value={formData[item.key] || ""}
                    placeholder={item.placeholder}
                    onChange={(val) => handleChange(item.key, val)}
                    onSave={() => updateMutation.mutateAsync({ key: item.key, value: formData[item.key] || "" })}
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-4 space-y-4">
            {/* I: Analytics — GA4 + GTM (both 100% free, no monthly fees) */}
            <Card>
              <CardHeader>
                <CardTitle>Google Analytics 4 (GA4)</CardTitle>
                <CardDescription>
                  GA4 is completely free — no monthly fees, no usage caps for standard use.
                  Create a free account at <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">analytics.google.com</a>,
                  create a property, and paste your Measurement ID below. The tracking script loads automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem
                  itemKey="ga4_measurement_id"
                  label="GA4 Measurement ID"
                  value={formData["ga4_measurement_id"] || ""}
                  placeholder="G-XXXXXXXXXX"
                  onChange={(val) => handleChange("ga4_measurement_id", val)}
                  onSave={() => updateMutation.mutateAsync({ key: "ga4_measurement_id", value: formData["ga4_measurement_id"] || "" })}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Format: <code className="bg-muted px-1 rounded text-xs">G-XXXXXXXXXX</code> — found in GA4 → Admin → Data Streams → your stream
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Google Tag Manager (GTM)</CardTitle>
                <CardDescription>
                  GTM is also free. Use it to manage GA4, Facebook Pixel, and other tags without code changes.
                  Create a free container at <a href="https://tagmanager.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">tagmanager.google.com</a>.
                  If you use GTM, you can manage GA4 from inside it — you don't need both fields filled in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingItem
                  itemKey="gtm_container_id"
                  label="GTM Container ID"
                  value={formData["gtm_container_id"] || ""}
                  placeholder="GTM-XXXXXXX"
                  onChange={(val) => handleChange("gtm_container_id", val)}
                  onSave={() => updateMutation.mutateAsync({ key: "gtm_container_id", value: formData["gtm_container_id"] || "" })}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Format: <code className="bg-muted px-1 rounded text-xs">GTM-XXXXXXX</code> — found in GTM → Admin → Container Settings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Uptime Monitoring (BetterStack)</CardTitle>
                <CardDescription>
                  BetterStack Uptime is free — unlimited monitors, 3-minute check intervals, no credit card required.
                  Sign up free at <a href="https://betterstack.com/uptime" target="_blank" rel="noopener noreferrer" className="text-primary underline">betterstack.com/uptime</a>,
                  create a monitor for your site, then add the credentials to your server environment.
                  These values go in your <code className="bg-muted px-1 rounded text-xs">.env</code> / Render environment variables — not stored in the database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-amber-800">Environment Variables Required (set in Render Dashboard → Environment)</p>
                  <div className="font-mono text-xs bg-white border border-amber-200 rounded p-3 space-y-1">
                    <p><span className="text-blue-600">BETTERSTACK_API_KEY</span>=your_api_key_here</p>
                    <p><span className="text-blue-600">BETTERSTACK_MONITOR_ID</span>=your_monitor_id_here</p>
                  </div>
                  <p className="text-amber-700 text-xs">
                    API Key: BetterStack → Account → API tokens. Monitor ID: visible in the URL when viewing your monitor.
                  </p>
                </div>
              </CardContent>
            </Card>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
