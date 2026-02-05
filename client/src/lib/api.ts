import { apiRequest } from "./queryClient";
import type {
  Tour,
  Booking,
  InsertBooking,
  User,
  InsertUser,
  SiteSetting,
  PaymentGateway,
  Payment,
  CmsContent,
  Notification,
  FeatureFlag,
} from "@shared/schema";

// Helper for image upload
export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/upload/image', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    throw new Error('Upload failed');
  }

  return res.json();
}

// Auth
export async function registerUser(user: any): Promise<User> {
  const res = await apiRequest("POST", "/api/auth/register", user);
  return res.json();
}

export async function logout() {
  await apiRequest("POST", "/api/auth/logout");
}

export async function fetchAllUsers(): Promise<User[]> {
  const res = await apiRequest("GET", "/api/users");
  return res.json();
}

export async function resetUserPassword(userId: string, newPassword?: string): Promise<User> {
  const res = await apiRequest("PATCH", `/api/users/${userId}/password`, { newPassword });
  return res.json();
}

export async function createUser(user: InsertUser): Promise<User> {
  const res = await apiRequest("POST", "/api/users", user);
  return res.json();
}


export async function updateUserRole(id: string, role: string): Promise<User> {
  const res = await apiRequest("PATCH", `/api/users/${id}/role`, { role });
  return res.json();
}

// Tours
export async function fetchTours(): Promise<Tour[]> {
  const res = await apiRequest("GET", "/api/tours");
  return res.json();
}

export async function fetchTour(id: string): Promise<Tour> {
  const res = await apiRequest("GET", `/api/tours/${id}`);
  return res.json();
}

export async function createTour(tour: any): Promise<Tour> {
  const res = await apiRequest("POST", "/api/tours", tour);
  return res.json();
}

export async function updateTour(id: string, tour: any): Promise<Tour> {
  const res = await apiRequest("PUT", `/api/tours/${id}`, tour);
  return res.json();
}

export async function deleteTour(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/tours/${id}`);
}

// Vehicles API (Vehicle Hire feature) - using the common tours endpoint since they share schema
export async function fetchVehicles(): Promise<Tour[]> {
    const tours = await fetchTours();
    return tours.filter(t => t.category === 'vehicle');
}

export async function fetchVehicle(id: string): Promise<Tour> {
  return fetchTour(id);
}

// Bookings
export async function fetchBookings(): Promise<Booking[]> {
  const res = await apiRequest("GET", "/api/bookings");
  return res.json();
}

export async function fetchBooking(id: string): Promise<Booking> {
  const res = await apiRequest("GET", `/api/bookings/${id}`);
  return res.json();
}

export async function fetchBookingItems(bookingId: string): Promise<any[]> {
  const res = await apiRequest("GET", `/api/bookings/${bookingId}/items`);
  return res.json();
}

export async function fetchBookingPayments(bookingId: string): Promise<Payment[]> {
  const res = await apiRequest("GET", `/api/payments/booking/${bookingId}`);
  return res.json();
}

export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  const res = await apiRequest("GET", `/api/bookings/user/${userId}`);
  return res.json();
}

export async function fetchQrCode(bookingId: string): Promise<{ qrData: string }> {
  const res = await apiRequest("GET", `/api/bookings/${bookingId}/qr`);
  return res.json();
}

export async function createBooking(booking: InsertBooking): Promise<Booking> {
  const res = await apiRequest("POST", "/api/bookings", booking);
  return res.json();
}

export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  const res = await apiRequest("PATCH", `/api/bookings/${id}`, updates);
  return res.json();
}

export async function deleteBooking(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/bookings/${id}`);
}

export async function initiatePayment(bookingId: string, gatewaySlug?: string): Promise<{ paymentId: string; redirectUrl: string }> {
  const res = await apiRequest("POST", "/api/payments/initiate", { bookingId, gatewaySlug });
  return res.json();
}

export async function exportBookingsCSV(): Promise<void> {
  const res = await apiRequest("GET", "/api/bookings/export");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bookings.csv';
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Analytics
export async function fetchBookingStats() {
  const res = await apiRequest("GET", "/api/analytics/stats");
  return res.json();
}

export async function fetchRevenue(): Promise<{ month: string; total: number }[]> {
  const res = await apiRequest("GET", "/api/analytics/revenue");
  return res.json();
}

// Site Settings
export async function fetchSiteSettings(): Promise<SiteSetting[]> {
  const res = await apiRequest("GET", "/api/settings");
  return res.json();
}

export async function updateSiteSetting(key: string, value: any): Promise<SiteSetting> {
  const res = await apiRequest("PUT", `/api/admin/settings/${key}`, { value });
  return res.json();
}

// Payment Gateways
export async function fetchPaymentGateways(): Promise<PaymentGateway[]> {
  const res = await apiRequest("GET", "/api/admin/payment-gateways");
  return res.json();
}

export async function updatePaymentGateway(id: string, data: Partial<PaymentGateway>): Promise<PaymentGateway> {
  const res = await apiRequest("PUT", `/api/admin/payment-gateways/${id}`, data);
  return res.json();
}

export async function setDefaultPaymentGateway(id: string): Promise<void> {
  await apiRequest("POST", `/api/admin/payment-gateways/${id}/set-default`);
}

// CMS Content
export async function fetchAllCmsContent(): Promise<Record<string, CmsContent[]>> {
  const res = await apiRequest("GET", "/api/cms-content");
  return res.json();
}

export async function createCmsContent(data: any): Promise<CmsContent> {
  const res = await apiRequest("POST", "/api/cms-content", data);
  return res.json();
}

export async function updateCmsContent(id: string, data: any): Promise<CmsContent> {
  const res = await apiRequest("PATCH", `/api/cms-content/${id}`, data);
  return res.json();
}

export async function deleteCmsContent(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/cms-content/${id}`);
}

// Newsletter
export async function subscribeNewsletter(data: {
  email: string;
  name?: string;
  locale?: string;
  source?: string;
}): Promise<void> {
  await apiRequest("POST", "/api/newsletter/subscribe", data);
}

export async function fetchNewsletterSubscribers(): Promise<any[]> {
  const res = await apiRequest("GET", "/api/newsletter/subscribers");
  return res.json();
}

// Wishlist
export async function fetchWishlist(): Promise<any[]> {
  const res = await apiRequest("GET", "/api/wishlist");
  return res.json();
}

export async function checkWishlist(tourId: string): Promise<boolean> {
  const res = await apiRequest("GET", `/api/wishlist/check/${tourId}`);
  return res.json().then(data => data.inWishlist);
}

export async function addToWishlist(tourId: string): Promise<void> {
  await apiRequest("POST", "/api/wishlist", { tourId });
}

export async function removeFromWishlist(tourId: string): Promise<void> {
  await apiRequest("DELETE", `/api/wishlist/${tourId}`);
}

// Notifications
export async function fetchNotifications(): Promise<Notification[]> {
  const res = await apiRequest("GET", "/api/notifications");
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiRequest("PATCH", `/api/notifications/${id}/read`);
}

export async function verifyBooking(data: { bookingId: string; type: string; value: string }): Promise<any> {
  const res = await apiRequest("POST", "/api/bookings/verify", data);
  return res.json();
}

export async function cancelBooking(id: string, verification: { type: string; value: string }): Promise<any> {
  const res = await apiRequest("POST", `/api/bookings/${id}/cancel`, verification);
  return res.json();
}

// Feature Flags
export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const res = await apiRequest("GET", "/api/feature-flags");
  return res.json();
}

export async function updateFeatureFlag(slug: string, enabled: boolean): Promise<FeatureFlag> {
  const res = await apiRequest("PATCH", `/api/admin/feature-flags/${slug}`, { enabled });
  return res.json();
}
