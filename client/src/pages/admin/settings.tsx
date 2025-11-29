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
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
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
  Clock
} from "lucide-react";

export default function AdminSettings() {
  const { toast } = useToast();
  
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
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> General
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Notifications
            </TabsTrigger>
            <TabsTrigger value="booking" className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> Booking
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payment
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
