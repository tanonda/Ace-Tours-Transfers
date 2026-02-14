import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export default function CustomerProfile() {
  const { toast } = useToast();
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
            <CardDescription>Update your contact details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="text-2xl bg-muted">JD</AvatarFallback>
              </Avatar>
              <Button variant="outline" onClick={() => toast({ title: "Change Avatar", description: "Opening image uploader..." })}>Change Avatar</Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input defaultValue="James" />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input defaultValue="Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input defaultValue="james.doe@example.com" />
              </div>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input defaultValue="+1 234 567 890" />
              </div>
            </div>
            
            <Button onClick={() => toast({ title: "Profile Updated", description: "Your profile information has been updated." })}>Save Changes</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your password and account access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" />
            </div>
            <Button variant="outline" className="mt-2" onClick={() => toast({ title: "Password Updated", description: "Your password has been changed successfully." })}>Update Password</Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
