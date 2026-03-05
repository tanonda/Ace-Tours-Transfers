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
import { Loader2, Save, Flag, Mail, Users, Download, Trash2, CheckCircle, Clock, Globe, CreditCard, Star, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
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
  onSave: () => Promise<any>;
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
    queryKey: ["admin-feature-flags"],
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
      queryClient.invalidateQueries({ queryKey: ["admin-feature-flags"] });
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
            <TabsTrigger value="email">Email Config</TabsTrigger>
            {/* Newsletter moved to its own dedicated page: /admin/newsletter */}
            <TabsTrigger value="payments">Payment Instructions</TabsTrigger>
            <TabsTrigger value="seo">SEO / GEO</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="flags">Feature Flags</TabsTrigger>
            <TabsTrigger value="backlinks">Backlinks</TabsTrigger>
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

          {/* Payment Instructions Tab */}
          <TabsContent value="payments" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Offline Payment Instructions
                </CardTitle>
                <CardDescription>
                  Configure guest-facing instructions for offline payment methods. These are shown to customers on their booking confirmation page and emails.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Bank Transfer */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">🏦 Bank Transfer</h3>
                  <SettingItem
                    itemKey="bank_transfer_account_name"
                    label="Account Name"
                    value={formData["bank_transfer_account_name"] || ""}
                    placeholder="e.g. Ace Tours & Transfers Vanuatu Ltd"
                    onChange={(val) => handleChange("bank_transfer_account_name", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_account_name", value: formData["bank_transfer_account_name"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_account_number"
                    label="Account Number"
                    value={formData["bank_transfer_account_number"] || ""}
                    placeholder="e.g. 1234567"
                    onChange={(val) => handleChange("bank_transfer_account_number", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_account_number", value: formData["bank_transfer_account_number"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_bank_name"
                    label="Bank Name"
                    value={formData["bank_transfer_bank_name"] || ""}
                    placeholder="e.g. BSP · ANZ · BRED"
                    onChange={(val) => handleChange("bank_transfer_bank_name", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_bank_name", value: formData["bank_transfer_bank_name"] || "" })}
                  />
                  <SettingItem
                    itemKey="bank_transfer_reference_format"
                    label="Reference Format"
                    value={formData["bank_transfer_reference_format"] || ""}
                    placeholder="e.g. Use your Booking ID as reference (e.g. ACT-XXXX)"
                    onChange={(val) => handleChange("bank_transfer_reference_format", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "bank_transfer_reference_format", value: formData["bank_transfer_reference_format"] || "" })}
                  />
                </div>

                {/* Cash on Delivery */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">💵 Cash on Delivery</h3>
                  <SettingItem
                    itemKey="cash_instructions"
                    label="Cash Payment Instructions"
                    value={formData["cash_instructions"] || ""}
                    placeholder="e.g. Pay your driver in cash (VUV preferred). Please bring exact change."
                    onChange={(val) => handleChange("cash_instructions", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "cash_instructions", value: formData["cash_instructions"] || "" })}
                  />
                  <SettingItem
                    itemKey="cash_accepted_currencies"
                    label="Accepted Currencies"
                    value={formData["cash_accepted_currencies"] || ""}
                    placeholder="e.g. VUV, AUD, NZD"
                    onChange={(val) => handleChange("cash_accepted_currencies", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "cash_accepted_currencies", value: formData["cash_accepted_currencies"] || "" })}
                  />
                </div>

                {/* E-Wallets */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm text-foreground border-b pb-2">📱 E-Wallets (WanTok · Digicel · KwikPay)</h3>
                  <SettingItem
                    itemKey="ewallet_phone_number"
                    label="Merchant Phone Number"
                    value={formData["ewallet_phone_number"] || ""}
                    placeholder="e.g. +678 7342389"
                    onChange={(val) => handleChange("ewallet_phone_number", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_phone_number", value: formData["ewallet_phone_number"] || "" })}
                  />
                  <SettingItem
                    itemKey="ewallet_reference_format"
                    label="Payment Reference"
                    value={formData["ewallet_reference_format"] || ""}
                    placeholder="e.g. Send your Booking ID as the payment reference"
                    onChange={(val) => handleChange("ewallet_reference_format", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_reference_format", value: formData["ewallet_reference_format"] || "" })}
                  />
                  <SettingItem
                    itemKey="ewallet_instructions"
                    label="Additional Instructions"
                    value={formData["ewallet_instructions"] || ""}
                    placeholder="e.g. Screenshot your payment receipt and email/WhatsApp to us for faster confirmation."
                    onChange={(val) => handleChange("ewallet_instructions", val)}
                    onSave={() => updateMutation.mutateAsync({ key: "ewallet_instructions", value: formData["ewallet_instructions"] || "" })}
                  />
                </div>
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

          {/* ── Integrations Tab ────────────────────────────────────────────── */}
          <TabsContent value="integrations" className="mt-4 space-y-4">

            {/* Review Provider Selector */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Review Provider
                </CardTitle>
                <CardDescription>
                  Choose which external review platform appears above the booking CTA and below guest reviews on all detail pages.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {(["trustpilot", "google", "none"] as const).map(option => {
                    const current = formData["review_provider"] ?? "trustpilot";
                    const isActive = current === option;
                    const labels: Record<string, string> = {
                      trustpilot: "Trustpilot",
                      google: "Google Reviews",
                      none: "None",
                    };
                    return (
                      <button
                        key={option}
                        onClick={() => {
                          setFormData(prev => ({ ...prev, review_provider: option }));
                          updateMutation.mutate({ key: "review_provider", value: option });
                        }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}
                      >
                        {labels[option]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current: <code className="bg-muted px-1 rounded">{formData["review_provider"] ?? "trustpilot"}</code>.
                  Changes take effect immediately.
                </p>
              </CardContent>
            </Card>

            {/* Google Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-white flex items-center justify-center border border-border/50">
                    <svg viewBox="0 0 24 24" className="w-4 h-4">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </div>
                  Google Reviews API
                </CardTitle>
                <CardDescription>
                  Fetches your latest ratings directly from Google Places.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">Configure Environment</p>
                  <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                    <p><span className="text-blue-500">GOOGLE_PLACES_API_KEY</span>=<span className="text-green-600">AIzaSy...</span></p>
                    <p><span className="text-blue-500">GOOGLE_PLACE_ID</span>=<span className="text-green-600">ChIJ...</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    Get your key from Google Cloud Console (Places API) and find your ID with Google's <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-primary underline">Finder</a>.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Trustpilot TrustBox Widget */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#00b67a] flex items-center justify-center">
                    <Star className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                  Trustpilot TrustBox Widget
                </CardTitle>
                <CardDescription>
                  Displays a live Trustpilot rating bar on every tour detail page.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Status badge */}
                {(() => {
                  const buId = import.meta.env.VITE_TRUSTPILOT_BU_ID;
                  return buId ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-500/30 bg-green-500/10">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">Widget Active</p>
                        <p className="text-xs text-muted-foreground">Business Unit ID: <code className="bg-muted px-1 rounded text-xs">{buId}</code></p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-900/20">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Widget Inactive — Business Unit ID not set</p>
                        <p className="text-xs text-muted-foreground">The fallback static link is shown to guests until you add the env var.</p>
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs tracking-wider text-muted-foreground uppercase">Required Environment Variables</p>
                  <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                    <p><span className="text-blue-500">VITE_TRUSTPILOT_BU_ID</span>=<span className="text-green-600">bu_id</span></p>
                    <p><span className="text-blue-500">VITE_TRUSTPILOT_URL</span>=<span className="text-green-600">https://www.trustpilot.com/review/acetours.vu</span></p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Obtain your Business Unit ID from <strong>Integrations → TrustBox Library</strong> in your Trustpilot Business account.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payments & SMS Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Stripe */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    Stripe Payments
                  </CardTitle>
                  <CardDescription>
                    Secure credit and debit card processing.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">STRIPE_PUBLISHABLE_KEY</span>=<span className="text-green-600">pk_...</span></p>
                      <p><span className="text-blue-500">STRIPE_SECRET_KEY</span>=<span className="text-green-600">sk_...</span></p>
                    </div>
                  </div>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
                      Open Stripe Dashboard <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* SMS Gateway */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-blue-500" />
                    SMS Notifications
                  </CardTitle>
                  <CardDescription>
                    Send booking alerts via Android SMS Gateway or Twilio.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">SMS_PROVIDER</span>=<span className="text-green-600">android_gateway</span> | <span className="text-green-600">twilio</span></p>
                      <p><span className="text-blue-500">SMS_GATEWAY_URL</span>=<span className="text-green-600">http://ip:port</span></p>
                      <p><span className="text-blue-500">TWILIO_ACCOUNT_SID</span>=<span className="text-green-600">AC...</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set provider to <code className="bg-muted px-1 rounded">android_gateway</code> for local Vanuatu SIM integration.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Email & Media Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cloudinary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#3448c5] flex items-center justify-center">
                      <span className="text-white font-bold text-xs">C</span>
                    </div>
                    Cloudinary Assets
                  </CardTitle>
                  <CardDescription>
                    Image optimization and cloud storage for tour photos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                      <p><span className="text-blue-500">VITE_CLOUDINARY_CLOUD_NAME</span>=<span className="text-green-600">name</span></p>
                    </div>
                  </div>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://cloudinary.com/console" target="_blank" rel="noopener noreferrer">
                      Open Cloudinary Console <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              {/* Email Gateway (Nodemailer) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-red-500" />
                    Google SMTP (Gmail)
                  </CardTitle>
                  <CardDescription>
                    Transaction emails for booking confirmations.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1">
                      <p><span className="text-blue-500">GMAIL_USER</span>=<span className="text-green-600">your-email@gmail.com</span></p>
                      <p><span className="text-blue-500">GMAIL_APP_PASSWORD</span>=<span className="text-green-600">16-char-code</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use "App Passwords" in Google Security settings. Standard passwords will not work.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Infra Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Redis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#d82c20] flex items-center justify-center">
                      <span className="text-white font-bold text-xs">R</span>
                    </div>
                    Redis Cache
                  </CardTitle>
                  <CardDescription>
                    Session storage and high-performance caching.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">REDIS_URL</span>=<span className="text-green-600">redis://...</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sentry */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#362d59] flex items-center justify-center">
                      <span className="text-white font-bold text-xs text-[10px]">S</span>
                    </div>
                    Sentry Monitoring
                  </CardTitle>
                  <CardDescription>
                    Error tracking and performance monitoring.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 text-sm">
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Required Environment Variables</p>
                    <div className="font-mono text-xs bg-background border border-border rounded p-3 space-y-1 overflow-x-auto">
                      <p><span className="text-blue-500">SENTRY_DSN</span>=<span className="text-green-600">https://...</span></p>
                      <p><span className="text-blue-500">VITE_SENTRY_DSN</span>=<span className="text-green-600">https://...</span></p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Render Dashboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-black flex items-center justify-center">
                    <span className="text-white font-bold text-xs">R</span>
                  </div>
                  Render Hosting
                </CardTitle>
                <CardDescription>
                  Access your server logs, redeploy the application, and manage environment variables.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm">Log in to the Render dashboard to monitor your web service performance, view deployment logs, or update environment variables (like adding API keys).</p>
                  <Button variant="outline" asChild size="sm">
                    <a href="https://dashboard.render.com" target="_blank" rel="noopener noreferrer">
                      Open Render Dashboard <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Neon Database */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-[#00e599] flex items-center justify-center">
                    <span className="text-black font-bold text-xs text-[10px]">Neon</span>
                  </div>
                  Neon Database
                </CardTitle>
                <CardDescription>
                  Manage your PostgreSQL database, view branches, and execute raw SQL queries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <p className="text-sm">Neon hosts your application data. Use the Neon console to manage backups, view storage limits, or check database connection string credentials.</p>
                  <Button variant="outline" asChild size="sm">
                    <a href="https://console.neon.tech" target="_blank" rel="noopener noreferrer">
                      Open Neon Console <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* BetterStack */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-500" />
                  BetterStack Monitoring
                </CardTitle>
                <CardDescription>
                  24/7 uptime monitoring and incident alerting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                  <p className="text-muted-foreground leading-relaxed italic">
                    Configure environment variables <code className="bg-muted px-1 rounded text-xs">BETTERSTACK_API_KEY</code> and <code className="bg-muted px-1 rounded text-xs">BETTERSTACK_MONITOR_ID</code> in Render to enable.
                  </p>
                  <Button variant="outline" asChild size="sm" className="w-full">
                    <a href="https://betterstack.com" target="_blank" rel="noopener noreferrer">
                      Open BetterStack <ExternalLink className="h-3 w-3 ml-2" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>


            {/* Banks Payment Gateways */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-green-600" />
                  Local Bank Gateways
                </CardTitle>
                <CardDescription>
                  Configure instructions for offline payments (BSP, ANZ, BRED, E-Wallets).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm">
                  <p className="text-blue-800">
                    Guest instructions for bank transfers and e-wallets are managed in the <strong>Payment Instructions</strong> tab.
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4 space-y-3 text-sm">
                  <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Switching Providers</p>
                  <p className="text-muted-foreground">
                    To enable/disable specific payment methods (like "Pay by Card" vs "Manual Bank Transfer"), go to the <strong>Feature Flags</strong> tab.
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
                {flags
                  .filter((flag: any) => !flag.slug.startsWith('payment-') && flag.slug !== 'stripe' && flag.slug !== 'local-bank')
                  .map((flag: any) => (
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

          {/* ── Backlinks Tab ──────────────────────────────────────────────── */}
          <TabsContent value="backlinks" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Footer Backlinks & Partners</CardTitle>
                <CardDescription>
                  Manage the external links displayed in the website footer.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SettingList
                  itemKey="footer_backlinks"
                  label="Footer Backlinks"
                  description="Enter links as 'Label | URL'. Example: 'Vanuatu Tourism | https://www.vanuatu.travel/'"
                  values={(formData["footer_backlinks"] || "").split("\n").filter(Boolean)}
                  onSave={async (newValues) => {
                    const str = newValues.join("\n");
                    setFormData(prev => ({ ...prev, footer_backlinks: str }));
                    await updateMutation.mutateAsync({ key: "footer_backlinks", value: str });
                  }}
                  placeholder="Label | URL"
                />
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
}
