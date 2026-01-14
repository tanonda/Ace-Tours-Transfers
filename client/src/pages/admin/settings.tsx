import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSiteSettings, updateSiteSetting } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";

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
    ]
  };

  if (isLoading) {
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
          <TabsList>
            <TabsTrigger value="contact">{t("footer.contactInfo")}</TabsTrigger>
            <TabsTrigger value="social">Social Media</TabsTrigger>
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
