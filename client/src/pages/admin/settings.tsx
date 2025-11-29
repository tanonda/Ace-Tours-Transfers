import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Bell,
  CreditCard,
  Shield,
  Palette,
  FileText,
  Clock,
  LayoutGrid,
  MessageCircle,
  Landmark
} from "lucide-react";

interface ContentBlock {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, any> | null;
  updatedAt: string;
}

interface PaymentGateway {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  active: boolean;
  isDefault: boolean;
  credentials: Record<string, any> | null;
  supportedCurrencies: string[] | null;
  config: Record<string, any> | null;
}

interface WhatsAppSettings {
  enabled: boolean;
  phoneNumber: string;
  greeting: string;
  position: string;
}

export default function AdminSettings() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  
  const { data: contentBlocks = [] } = useQuery<ContentBlock[]>({
    queryKey: ["admin-content-blocks"],
    queryFn: async () => {
      const res = await fetch("/api/content-blocks");
      if (!res.ok) throw new Error("Failed to fetch content blocks");
      return res.json();
    }
  });

  const { data: paymentGateways = [] } = useQuery<PaymentGateway[]>({
    queryKey: ["admin-payment-gateways"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payment-gateways", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment gateways");
      return res.json();
    }
  });

  const { data: whatsappSetting } = useQuery({
    queryKey: ["admin-whatsapp-setting"],
    queryFn: async () => {
      const res = await fetch("/api/settings/whatsapp");
      if (!res.ok) return null;
      return res.json();
    }
  });

  const [whatsappConfig, setWhatsappConfig] = useState<WhatsAppSettings>({
    enabled: true,
    phoneNumber: "+678 5551234",
    greeting: "Hello! How can we help you with your Vanuatu adventure?",
    position: "bottom-right"
  });

  // Update whatsapp config when data loads
  useState(() => {
    if (whatsappSetting?.value) {
      setWhatsappConfig(whatsappSetting.value);
    }
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async ({ slug, enabled }: { slug: string; enabled: boolean }) => {
      const res = await fetch(`/api/admin/content-blocks/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled })
      });
      if (!res.ok) throw new Error("Failed to update content block");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-content-blocks"] });
      queryClient.invalidateQueries({ queryKey: ["content-blocks"] });
      toast({ title: t("cms.updated") });
    }
  });

  const toggleGatewayMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await fetch(`/api/admin/payment-gateways/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ active })
      });
      if (!res.ok) throw new Error("Failed to update gateway");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-gateways"] });
      toast({ title: "Payment gateway updated" });
    }
  });

  const setDefaultGatewayMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/payment-gateways/${id}/set-default`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to set default gateway");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-payment-gateways"] });
      toast({ title: "Default gateway updated" });
    }
  });

  const saveWhatsappMutation = useMutation({
    mutationFn: async (config: WhatsAppSettings) => {
      const res = await fetch("/api/admin/settings/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ value: config })
      });
      if (!res.ok) throw new Error("Failed to save WhatsApp settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings"] });
      toast({ title: "WhatsApp settings saved" });
    }
  });
  
  const [settings, setSettings] = useState({
    companyName: 'Ace Tours & Transfers',
    contactEmail: 'info@acetours.vu',
    phone: '+678 123 4567',
    address: 'Port Vila, Vanuatu',
    website: 'www.acetours.vu',
    currency: 'VUV',
    timezone: 'Pacific/Efate',
    bookingEmail: true,
    inquiryNotification: true,
    paymentNotification: true,
    cancellationNotification: true,
    dailyReport: false,
    weeklyReport: true,
    minAdvanceBooking: '24',
    maxGuestsPerBooking: '20',
    cancellationPolicy: '24 hours before tour',
    termsOfService: 'Standard terms apply...',
    paymentMethods: ['card', 'cash'],
    requireDeposit: true,
    depositPercentage: '30',
    autoConfirm: false
  });

  const handleSave = (section: string) => {
    toast({ 
      title: "Settings Saved", 
      description: `${section} settings have been updated successfully.` 
    });
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#004165]">Settings</h1>
          <p className="text-muted-foreground">Manage your website and booking configuration.</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-1">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="cms" className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" /> CMS
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="gateways" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" /> Banks
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Alerts
            </TabsTrigger>
            <TabsTrigger value="booking" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Booking
            </TabsTrigger>
            <TabsTrigger value="policies" className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Policies
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Basic details about your business that appear across the website.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      Company Name
                    </Label>
                    <Input 
                      value={settings.companyName}
                      onChange={(e) => setSettings({...settings, companyName: e.target.value})}
                      data-testid="input-company-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Contact Email
                    </Label>
                    <Input 
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
                      data-testid="input-contact-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Phone Number
                    </Label>
                    <Input 
                      value={settings.phone}
                      onChange={(e) => setSettings({...settings, phone: e.target.value})}
                      data-testid="input-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      Website
                    </Label>
                    <Input 
                      value={settings.website}
                      onChange={(e) => setSettings({...settings, website: e.target.value})}
                      data-testid="input-website"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Business Address
                  </Label>
                  <Input 
                    value={settings.address}
                    onChange={(e) => setSettings({...settings, address: e.target.value})}
                    data-testid="input-address"
                  />
                </div>
                
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Default Currency</Label>
                    <Select 
                      value={settings.currency} 
                      onValueChange={(v) => setSettings({...settings, currency: v})}
                    >
                      <SelectTrigger data-testid="select-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VUV">Vanuatu Vatu (VUV)</SelectItem>
                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                        <SelectItem value="AUD">Australian Dollar (AUD)</SelectItem>
                        <SelectItem value="NZD">New Zealand Dollar (NZD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select 
                      value={settings.timezone} 
                      onValueChange={(v) => setSettings({...settings, timezone: v})}
                    >
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Pacific/Efate">Pacific/Efate (VUT)</SelectItem>
                        <SelectItem value="Australia/Sydney">Australia/Sydney (AEST)</SelectItem>
                        <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('General')}
                  data-testid="button-save-general"
                >
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cms">
            <Card>
              <CardHeader>
                <CardTitle>{t("cms.title")}</CardTitle>
                <CardDescription>{t("cms.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {contentBlocks.map((block) => (
                  <div 
                    key={block.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`cms-block-${block.slug}`}
                  >
                    <div className="space-y-0.5">
                      <Label className="text-base">{block.label}</Label>
                      <p className="text-sm text-muted-foreground">
                        {block.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={block.enabled ? "default" : "secondary"}>
                        {block.enabled ? t("cms.enabled") : t("cms.disabled")}
                      </Badge>
                      <Switch 
                        checked={block.enabled}
                        onCheckedChange={(enabled) => toggleBlockMutation.mutate({ slug: block.slug, enabled })}
                        data-testid={`toggle-block-${block.slug}`}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                  WhatsApp Chat Widget
                </CardTitle>
                <CardDescription>Configure the floating WhatsApp chat button.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Enable WhatsApp Widget</Label>
                    <p className="text-sm text-muted-foreground">
                      Show floating WhatsApp button on all pages
                    </p>
                  </div>
                  <Switch 
                    checked={whatsappConfig.enabled}
                    onCheckedChange={(enabled) => setWhatsappConfig({...whatsappConfig, enabled})}
                    data-testid="toggle-whatsapp-enabled"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>WhatsApp Phone Number</Label>
                  <Input 
                    value={whatsappConfig.phoneNumber}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, phoneNumber: e.target.value})}
                    placeholder="+678 1234567"
                    data-testid="input-whatsapp-phone"
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code (e.g., +678 for Vanuatu)
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Greeting Message</Label>
                  <Textarea 
                    value={whatsappConfig.greeting}
                    onChange={(e) => setWhatsappConfig({...whatsappConfig, greeting: e.target.value})}
                    rows={3}
                    placeholder="Hello! How can we help you?"
                    data-testid="input-whatsapp-greeting"
                  />
                  <p className="text-xs text-muted-foreground">
                    This message will be pre-filled when customers open chat
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Widget Position</Label>
                  <Select 
                    value={whatsappConfig.position} 
                    onValueChange={(v) => setWhatsappConfig({...whatsappConfig, position: v})}
                  >
                    <SelectTrigger data-testid="select-whatsapp-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  className="bg-green-600 hover:bg-green-700" 
                  onClick={() => saveWhatsappMutation.mutate(whatsappConfig)}
                  data-testid="button-save-whatsapp"
                >
                  Save WhatsApp Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gateways">
            <Card>
              <CardHeader>
                <CardTitle>{t("payments.title")}</CardTitle>
                <CardDescription>{t("payments.description")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {paymentGateways.map((gateway) => (
                  <div 
                    key={gateway.id} 
                    className="p-4 border rounded-lg space-y-4"
                    data-testid={`gateway-${gateway.slug}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Landmark className="h-5 w-5 text-muted-foreground" />
                          <Label className="text-lg font-semibold">{gateway.displayName}</Label>
                          {gateway.isDefault && (
                            <Badge className="bg-blue-500">{t("payments.default")}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {gateway.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Currencies: {gateway.supportedCurrencies?.join(", ") || "VUV"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={gateway.active ? "default" : "secondary"}>
                          {gateway.active ? t("payments.active") : t("payments.inactive")}
                        </Badge>
                        <Switch 
                          checked={gateway.active}
                          onCheckedChange={(active) => toggleGatewayMutation.mutate({ id: gateway.id, active })}
                          data-testid={`toggle-gateway-${gateway.slug}`}
                        />
                      </div>
                    </div>
                    
                    {gateway.active && !gateway.isDefault && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDefaultGatewayMutation.mutate(gateway.id)}
                        data-testid={`set-default-${gateway.slug}`}
                      >
                        {t("payments.setDefault")}
                      </Button>
                    )}
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">{t("payments.merchantId")}</Label>
                        <Input 
                          placeholder="Enter merchant ID"
                          defaultValue={(gateway.credentials as any)?.merchantId || ""}
                          data-testid={`input-merchant-${gateway.slug}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">{t("payments.apiKey")}</Label>
                        <Input 
                          type="password"
                          placeholder="Enter API key"
                          defaultValue={(gateway.credentials as any)?.apiKey || ""}
                          data-testid={`input-apikey-${gateway.slug}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">{t("payments.environment")}</Label>
                        <Select defaultValue={(gateway.credentials as any)?.environment || "sandbox"}>
                          <SelectTrigger data-testid={`select-env-${gateway.slug}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">{t("payments.sandbox")}</SelectItem>
                            <SelectItem value="production">{t("payments.production")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('Payment Gateways')}
                  data-testid="button-save-gateways"
                >
                  Save Gateway Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Email Notifications</CardTitle>
                <CardDescription>Configure when and how you receive email alerts.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">New Booking Alert</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive an email when a new booking is made.
                      </p>
                    </div>
                    <Switch 
                      checked={settings.bookingEmail}
                      onCheckedChange={(v) => setSettings({...settings, bookingEmail: v})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Customer Inquiry</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications for contact form submissions.
                      </p>
                    </div>
                    <Switch 
                      checked={settings.inquiryNotification}
                      onCheckedChange={(v) => setSettings({...settings, inquiryNotification: v})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Payment Received</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified when a payment is processed successfully.
                      </p>
                    </div>
                    <Switch 
                      checked={settings.paymentNotification}
                      onCheckedChange={(v) => setSettings({...settings, paymentNotification: v})}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-0.5">
                      <Label className="text-base">Booking Cancellation</Label>
                      <p className="text-sm text-muted-foreground">
                        Alert when a booking is cancelled by customer.
                      </p>
                    </div>
                    <Switch 
                      checked={settings.cancellationNotification}
                      onCheckedChange={(v) => setSettings({...settings, cancellationNotification: v})}
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-4">Report Preferences</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base">Daily Summary</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive a daily report of bookings and revenue.
                        </p>
                      </div>
                      <Switch 
                        checked={settings.dailyReport}
                        onCheckedChange={(v) => setSettings({...settings, dailyReport: v})}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label className="text-base">Weekly Report</Label>
                        <p className="text-sm text-muted-foreground">
                          Comprehensive weekly performance report.
                        </p>
                      </div>
                      <Switch 
                        checked={settings.weeklyReport}
                        onCheckedChange={(v) => setSettings({...settings, weeklyReport: v})}
                      />
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('Notification')}
                  data-testid="button-save-notifications"
                >
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="booking">
            <Card>
              <CardHeader>
                <CardTitle>Booking Configuration</CardTitle>
                <CardDescription>Set rules and limits for tour bookings.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Minimum Advance Booking (hours)</Label>
                    <Input 
                      type="number"
                      value={settings.minAdvanceBooking}
                      onChange={(e) => setSettings({...settings, minAdvanceBooking: e.target.value})}
                      data-testid="input-min-advance"
                    />
                    <p className="text-xs text-muted-foreground">
                      How far in advance customers must book
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Guests per Booking</Label>
                    <Input 
                      type="number"
                      value={settings.maxGuestsPerBooking}
                      onChange={(e) => setSettings({...settings, maxGuestsPerBooking: e.target.value})}
                      data-testid="input-max-guests"
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum group size for a single booking
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Auto-confirm Bookings</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically confirm bookings when payment is received.
                    </p>
                  </div>
                  <Switch 
                    checked={settings.autoConfirm}
                    onCheckedChange={(v) => setSettings({...settings, autoConfirm: v})}
                  />
                </div>
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('Booking')}
                  data-testid="button-save-booking"
                >
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment">
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment methods and deposit requirements.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label className="text-base">Require Deposit</Label>
                    <p className="text-sm text-muted-foreground">
                      Collect a deposit at the time of booking.
                    </p>
                  </div>
                  <Switch 
                    checked={settings.requireDeposit}
                    onCheckedChange={(v) => setSettings({...settings, requireDeposit: v})}
                  />
                </div>
                
                {settings.requireDeposit && (
                  <div className="space-y-2">
                    <Label>Deposit Percentage (%)</Label>
                    <Input 
                      type="number"
                      value={settings.depositPercentage}
                      onChange={(e) => setSettings({...settings, depositPercentage: e.target.value})}
                      max="100"
                      min="0"
                      data-testid="input-deposit-percentage"
                    />
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-4">
                  <Label className="text-base">Accepted Payment Methods</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <span>Credit/Debit Card</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">💵</span>
                        <span>Cash on Arrival</span>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🏦</span>
                        <span>Bank Transfer</span>
                      </div>
                      <Switch />
                    </div>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">📱</span>
                        <span>Mobile Payment</span>
                      </div>
                      <Switch />
                    </div>
                  </div>
                </div>
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('Payment')}
                  data-testid="button-save-payment"
                >
                  Save Payment Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies">
            <Card>
              <CardHeader>
                <CardTitle>Cancellation & Policies</CardTitle>
                <CardDescription>Define your business policies and terms.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Cancellation Policy</Label>
                  <Textarea 
                    value={settings.cancellationPolicy}
                    onChange={(e) => setSettings({...settings, cancellationPolicy: e.target.value})}
                    rows={4}
                    placeholder="Describe your cancellation policy..."
                    data-testid="input-cancellation-policy"
                  />
                  <p className="text-xs text-muted-foreground">
                    This will be shown to customers during booking
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Terms of Service</Label>
                  <Textarea 
                    value={settings.termsOfService}
                    onChange={(e) => setSettings({...settings, termsOfService: e.target.value})}
                    rows={6}
                    placeholder="Enter your terms of service..."
                    data-testid="input-terms"
                  />
                </div>
                
                <Button 
                  className="bg-[#004165]" 
                  onClick={() => handleSave('Policy')}
                  data-testid="button-save-policies"
                >
                  Save Policies
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
