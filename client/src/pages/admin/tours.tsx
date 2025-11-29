import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash, Eye, Clock, Users, DollarSign, ImageIcon } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchTours, fetchBookings } from "@/lib/api";
import { useState, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Tour } from "@shared/schema";

interface TourFormData {
  title: string;
  price: string;
  childPrice: string;
  duration: string;
  minPax: string;
  image: string;
  description: string[];
  category: 'tour' | 'transfer';
}

const defaultFormData: TourFormData = {
  title: '',
  price: '',
  childPrice: '',
  duration: '',
  minPax: '1',
  image: '',
  description: [''],
  category: 'tour'
};

export default function AdminTours() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTour, setEditingTour] = useState<Tour | null>(null);
  const [viewingTour, setViewingTour] = useState<Tour | null>(null);
  const [formData, setFormData] = useState<TourFormData>(defaultFormData);

  const { data: tours = [], isLoading: toursLoading } = useQuery({
    queryKey: ["tours"],
    queryFn: fetchTours,
    staleTime: 30000,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: fetchBookings,
    staleTime: 30000,
  });

  const isLoading = toursLoading || bookingsLoading;

  const createMutation = useMutation({
    mutationFn: async (data: TourFormData) => {
      const response = await fetch('/api/tours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create tour');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: "Tour Created", description: "New tour has been added successfully." });
      setIsCreateOpen(false);
      setFormData(defaultFormData);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create tour", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TourFormData }) => {
      const response = await fetch(`/api/tours/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update tour');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tours"] });
      toast({ title: "Tour Updated", description: "Tour has been updated successfully." });
      setEditingTour(null);
      setFormData(defaultFormData);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update tour", variant: "destructive" });
    }
  });

  const filteredTours = useMemo(() => {
    return tours.filter(tour => {
      const matchesSearch = tour.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || tour.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [tours, searchQuery, categoryFilter]);

  const tourBookingData = useMemo(() => {
    const stats: Record<string, { bookings: number; revenue: number }> = {};
    for (const tour of tours) {
      stats[tour.id] = { bookings: 0, revenue: 0 };
    }
    for (const booking of bookings) {
      if (stats[booking.tourId]) {
        stats[booking.tourId].bookings += 1;
        stats[booking.tourId].revenue += parseFloat(booking.amount?.replace(/[^0-9.-]+/g, '') || '0');
      }
    }
    return stats;
  }, [tours, bookings]);

  const getTourBookingsCount = useCallback((tourId: string) => {
    return tourBookingData[tourId]?.bookings || 0;
  }, [tourBookingData]);

  const getTourRevenue = useCallback((tourId: string) => {
    return tourBookingData[tourId]?.revenue || 0;
  }, [tourBookingData]);

  const handleCreateTour = () => {
    if (!formData.title || !formData.price) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleDeleteTour = async (tourId: string) => {
    if (!confirm("Are you sure you want to delete this tour?")) return;
    
    try {
      const response = await fetch(`/api/tours/${tourId}`, { method: 'DELETE' });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["tours"] });
        toast({ title: "Deleted", description: "Tour has been removed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete tour", variant: "destructive" });
    }
  };

  const handleEditTour = (tour: Tour) => {
    setEditingTour(tour);
    setFormData({
      title: tour.title,
      price: tour.price,
      childPrice: tour.childPrice || '',
      duration: tour.duration,
      minPax: tour.minPax || '1',
      image: tour.image,
      description: tour.description,
      category: tour.category as 'tour' | 'transfer'
    });
  };

  const handleUpdateTour = () => {
    if (!editingTour || !formData.title || !formData.price) {
      toast({ title: "Validation Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: editingTour.id, data: formData });
  };

  const handleCloseEditDialog = () => {
    setEditingTour(null);
    setFormData(defaultFormData);
  };

  const tourStats = {
    totalTours: tours.filter(t => t.category === 'tour').length,
    totalTransfers: tours.filter(t => t.category === 'transfer').length,
    totalBookings: bookings.length,
    totalRevenue: bookings.reduce((sum, b) => 
      sum + parseFloat(b.amount?.replace(/[^0-9.-]+/g, '') || '0'), 0
    )
  };

  return (
    <DashboardLayout type="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#004165]">Tours & Services</h1>
            <p className="text-muted-foreground">Manage your tour packages and transfer services.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#004165]" data-testid="button-add-tour">
                <Plus className="h-4 w-4 mr-2" /> Add New Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Create New Service</DialogTitle>
                <DialogDescription>
                  Add a new tour or transfer service to your offerings.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Service Type</Label>
                    <Select 
                      value={formData.category} 
                      onValueChange={(v: 'tour' | 'transfer') => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger data-testid="select-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tour">Tour Package</SelectItem>
                        <SelectItem value="transfer">Transfer Service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input 
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Sunset Cruise Experience"
                      data-testid="input-title"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Adult Price *</Label>
                    <Input 
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="$150"
                      data-testid="input-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Child Price</Label>
                    <Input 
                      value={formData.childPrice}
                      onChange={(e) => setFormData({ ...formData, childPrice: e.target.value })}
                      placeholder="$75"
                      data-testid="input-child-price"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min. Guests</Label>
                    <Input 
                      type="number"
                      value={formData.minPax}
                      onChange={(e) => setFormData({ ...formData, minPax: e.target.value })}
                      min="1"
                      data-testid="input-min-pax"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration</Label>
                    <Input 
                      value={formData.duration}
                      onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                      placeholder="e.g., 4 hours"
                      data-testid="input-duration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Image URL</Label>
                    <Input 
                      value={formData.image}
                      onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                      placeholder="https://..."
                      data-testid="input-image"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={formData.description.join('\n')}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value.split('\n') })}
                    placeholder="Enter each feature on a new line..."
                    rows={4}
                    data-testid="input-description"
                  />
                  <p className="text-xs text-muted-foreground">Enter each feature or highlight on a new line</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateTour} className="bg-[#004165]" data-testid="button-save-tour">
                  Create Service
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100">
                  <ImageIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tours</p>
                  <p className="text-2xl font-bold">{tourStats.totalTours}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transfers</p>
                  <p className="text-2xl font-bold">{tourStats.totalTransfers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-purple-100">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{tourStats.totalBookings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-yellow-100">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${tourStats.totalRevenue.toFixed(0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search services..." 
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-tours"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="tour">Tours</SelectItem>
                  <SelectItem value="transfer">Transfers</SelectItem>
                </SelectContent>
              </Select>
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
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-center">Bookings</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading tours...
                    </TableCell>
                  </TableRow>
                ) : filteredTours.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      No tours found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTours.map((tour) => (
                    <TableRow key={tour.id} data-testid={`row-tour-${tour.id}`}>
                      <TableCell>
                        <div className="h-12 w-16 bg-muted rounded-md overflow-hidden flex-shrink-0">
                          <img 
                            src={tour.image || '/placeholder-tour.jpg'} 
                            alt={tour.title} 
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {tour.title}
                      </TableCell>
                      <TableCell>
                        <Badge className={tour.category === 'tour' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                        }>
                          {tour.category === 'tour' ? 'Tour' : 'Transfer'}
                        </Badge>
                      </TableCell>
                      <TableCell>{tour.price}</TableCell>
                      <TableCell>{tour.duration}</TableCell>
                      <TableCell className="text-center">
                        {getTourBookingsCount(tour.id)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${getTourRevenue(tour.id).toFixed(0)}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100" variant="outline">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => setViewingTour(tour)}
                            data-testid={`button-view-${tour.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleEditTour(tour)}
                            data-testid={`button-edit-${tour.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteTour(tour.id)}
                            data-testid={`button-delete-${tour.id}`}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={!!viewingTour} onOpenChange={() => setViewingTour(null)}>
          <DialogContent className="sm:max-w-[600px]">
            {viewingTour && (
              <>
                <DialogHeader>
                  <DialogTitle>{viewingTour.title}</DialogTitle>
                  <DialogDescription>
                    {viewingTour.category === 'tour' ? 'Tour Package' : 'Transfer Service'} Details
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <img 
                    src={viewingTour.image} 
                    alt={viewingTour.title}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Adult Price</p>
                      <p className="font-bold text-lg">{viewingTour.price}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-bold text-lg">{viewingTour.duration}</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Min. Guests</p>
                      <p className="font-bold text-lg">{viewingTour.minPax}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Description & Features</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {viewingTour.description.map((desc, i) => (
                        <li key={i}>{desc}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Bookings</p>
                      <p className="text-xl font-bold">{getTourBookingsCount(viewingTour.id)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-xl font-bold">${getTourRevenue(viewingTour.id).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingTour} onOpenChange={handleCloseEditDialog}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Edit Service</DialogTitle>
              <DialogDescription>
                Update the details for this tour or transfer service.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select 
                    value={formData.category} 
                    onValueChange={(v: 'tour' | 'transfer') => setFormData({ ...formData, category: v })}
                  >
                    <SelectTrigger data-testid="edit-select-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tour">Tour Package</SelectItem>
                      <SelectItem value="transfer">Transfer Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Island Tour"
                    data-testid="edit-input-title"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Adult Price *</Label>
                  <Input 
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="e.g., $120 / adult"
                    data-testid="edit-input-price"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Child Price</Label>
                  <Input 
                    value={formData.childPrice}
                    onChange={(e) => setFormData({ ...formData, childPrice: e.target.value })}
                    placeholder="e.g., $60 / child"
                    data-testid="edit-input-child-price"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Input 
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="e.g., 4-5 Hours"
                    data-testid="edit-input-duration"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min. Passengers</Label>
                  <Input 
                    value={formData.minPax}
                    onChange={(e) => setFormData({ ...formData, minPax: e.target.value })}
                    placeholder="e.g., 10-14 pax"
                    data-testid="edit-input-min-pax"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Image URL</Label>
                <Input 
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                  data-testid="edit-input-image"
                />
              </div>
              <div className="space-y-2">
                <Label>Description & Features</Label>
                {formData.description.map((desc, index) => (
                  <div key={index} className="flex gap-2">
                    <Input 
                      value={desc}
                      onChange={(e) => {
                        const newDesc = [...formData.description];
                        newDesc[index] = e.target.value;
                        setFormData({ ...formData, description: newDesc });
                      }}
                      placeholder={`Feature ${index + 1}`}
                      data-testid={`edit-input-desc-${index}`}
                    />
                    {formData.description.length > 1 && (
                      <Button 
                        type="button"
                        variant="outline" 
                        size="icon"
                        onClick={() => {
                          const newDesc = formData.description.filter((_, i) => i !== index);
                          setFormData({ ...formData, description: newDesc });
                        }}
                        data-testid={`edit-button-remove-desc-${index}`}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button 
                  type="button"
                  variant="outline" 
                  className="w-full mt-2"
                  onClick={() => setFormData({ ...formData, description: [...formData.description, ''] })}
                  data-testid="edit-button-add-desc"
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Feature
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseEditDialog} data-testid="edit-button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleUpdateTour} 
                disabled={updateMutation.isPending}
                className="bg-[#004165]"
                data-testid="edit-button-save"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
