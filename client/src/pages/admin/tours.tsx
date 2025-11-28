import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MoreHorizontal, Edit, Trash } from "lucide-react";
import { tours, transfers } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";

export default function AdminTours() {
  const { toast } = useToast();
  const allServices = [...tours, ...transfers];

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Tours & Services</h1>
            <p className="text-muted-foreground">Manage your tour packages and transfer services.</p>
          </div>
          <Button className="bg-[#004165]" onClick={() => toast({ title: "Add Service", description: "Opening new service form..." })}>
            <Plus className="h-4 w-4 mr-2" /> Add New Service
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search services..." className="pl-8" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Image</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allServices.map((service, index) => (
                  <TableRow key={`${service.id}-${index}`}>
                    <TableCell>
                      <img src={service.image} alt={service.title} className="h-12 w-16 object-cover rounded-md" />
                    </TableCell>
                    <TableCell className="font-medium">{service.title}</TableCell>
                    <TableCell>
                      {tours.some(t => t.id === service.id) ? "Tour" : "Transfer"}
                    </TableCell>
                    <TableCell>{service.price}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="outline">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => toast({ title: "Edit Service", description: `Editing ${service.title}` })}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => toast({ title: "Delete Service", description: `${service.title} has been deleted`, variant: "destructive" })}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
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
