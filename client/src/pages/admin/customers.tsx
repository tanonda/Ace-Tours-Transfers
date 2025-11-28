import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Mail, Phone } from "lucide-react";

const customers = [
  { id: 1, name: "James Wilson", email: "james.w@example.com", phone: "+61 412 345 678", bookings: 3, totalSpent: "$580", joinDate: "Jan 12, 2024" },
  { id: 2, name: "Sarah Connor", email: "sarah.c@example.com", phone: "+1 202 555 0123", bookings: 1, totalSpent: "$60", joinDate: "Feb 05, 2024" },
  { id: 3, name: "Michael Chen", email: "m.chen@example.com", phone: "+86 139 1234 5678", bookings: 5, totalSpent: "$1,200", joinDate: "Mar 20, 2024" },
  { id: 4, name: "Emma Watson", email: "emma.w@example.com", phone: "+44 7700 900077", bookings: 2, totalSpent: "$450", joinDate: "Apr 10, 2024" },
];

export default function AdminCustomers() {
  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Customers</h1>
            <p className="text-muted-foreground">View and manage registered customers.</p>
          </div>
          <Button variant="outline">Export List</Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Join Date</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>{customer.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">ID: #{customer.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" /> {customer.email}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3 text-muted-foreground" /> {customer.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.joinDate}</TableCell>
                    <TableCell className="text-center">{customer.bookings}</TableCell>
                    <TableCell className="text-right font-medium">{customer.totalSpent}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">View Profile</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
