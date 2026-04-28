import { apiRequest } from "./queryClient";
import i18n from "./i18n";
import type {
  Product,
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
  Addon,
} from "@shared/schema";

// Helper for image upload
export async function uploadImage(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/admin/upload', {
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

export async function resetPassword(data: { token: string; newPassword: string }): Promise<void> {
  await apiRequest("POST", "/api/auth/reset-password", data);
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

export async function updateUserStatus(id: string, isActive: boolean): Promise<User> {
  const res = await apiRequest("PATCH", `/api/users/${id}/status`, { isActive });
  return res.json();
}

// Products (covers tours and transfers)
export async function fetchProducts(): Promise<Product[]> {
  const locale = i18n.language || "en";
  const res = await apiRequest("GET", `/api/products?locale=${locale}`);
  return res.json();
}

export async function fetchProduct(id: string): Promise<Product> {
  const locale = i18n.language || "en";
  const res = await apiRequest("GET", `/api/products/${id}?locale=${locale}`);
  return res.json();
}

export async function createProduct(product: any): Promise<Product> {
  const res = await apiRequest("POST", "/api/products", product);
  return res.json();
}

export async function updateProduct(id: string, product: any): Promise<Product> {
  const res = await apiRequest("PUT", `/api/products/${id}`, product);
  return res.json();
}

export async function deleteProduct(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/products/${id}`);
}

// Backward-compatibility aliases (deprecated — use fetchProducts/createProduct/etc.)
export const fetchTour = fetchProduct;
export const createTour = createProduct;
export const updateTour = updateProduct;
export const deleteTour = deleteProduct;

// Addons
export async function fetchAddons(): Promise<Addon[]> {
  const res = await apiRequest("GET", "/api/addons");
  return res.json();
}

// Bookings
export async function fetchBookings(includeArchived: boolean = false): Promise<Booking[]> {
  const qs = includeArchived ? '?includeArchived=true' : '';
  const res = await apiRequest("GET", `/api/bookings${qs}`);
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
  const res = await apiRequest("GET", `/api/bookings/${bookingId}/payments`);
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

export async function deleteBooking(id: string, hardDelete: boolean = false): Promise<void> {
  const qs = hardDelete ? '?hard=true' : '';
  await apiRequest("DELETE", `/api/bookings/${id}${qs}`);
}

export async function initiatePayment(bookingId: string, provider?: string): Promise<{ paymentId: string; checkoutUrl: string }> {
  const res = await apiRequest("POST", "/api/payments/checkout", { bookingId, provider });
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

export async function fetchRevenue(): Promise<{ date: string; amount: number }[]> {
  const res = await apiRequest("GET", "/api/analytics/revenue/daily?days=365");
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
  const res = await apiRequest("GET", "/api/payment-gateways");
  return res.json();
}

// Guest-facing payment methods (grouped by category)
export interface PaymentMethodOption {
  method: string;
  label: string;
  description: string;
  icon: string;
  gatewaySlug?: string;
  gatewayId?: string;
  subOptions?: Array<{ slug: string; label: string; id?: string }>;
}

export async function fetchPaymentMethods(): Promise<PaymentMethodOption[]> {
  const res = await apiRequest("GET", "/api/payment-methods");
  return res.json();
}

export async function fetchAdminPaymentGateways(): Promise<PaymentGateway[]> {
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
export async function fetchAllCmsContent(locale?: string): Promise<Record<string, CmsContent[]>> {
  const qs = locale ? `?locale=${locale}` : '';
  const res = await apiRequest("GET", `/api/content-blocks${qs}`);
  return res.json();
}

export async function createCmsContent(data: any): Promise<CmsContent> {
  const res = await apiRequest("POST", "/api/admin/cms-content", data);
  return res.json();
}

export async function updateCmsContent(id: string, data: any): Promise<CmsContent> {
  const res = await apiRequest("PATCH", `/api/admin/cms-content/${id}`, data);
  return res.json();
}

export async function autoTranslateCmsContent(id: string): Promise<{ translated: CmsContent[]; sourceId: string; locales: string[] }> {
  const res = await apiRequest("POST", "/api/admin/cms-content/auto-translate", { id });
  return res.json();
}

export async function deleteCmsContent(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/cms-content/${id}`);
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

export async function sendWelcomeEmail(userId: string): Promise<void> {
  await apiRequest("POST", `/api/users/${userId}/send-welcome`);
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

// Blackout Dates (Phase 4)
export async function fetchBlackoutDates(productId: string): Promise<any[]> {
  const res = await apiRequest("GET", `/api/admin/blackouts/${productId}`);
  return res.json();
}

export async function createBlackoutDate(data: { productId: string; date: string; reason?: string }): Promise<any> {
  const res = await apiRequest("POST", `/api/admin/blackouts`, data);
  return res.json();
}

export async function deleteBlackoutDate(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/blackouts/${id}`);
}

// Pricing Engine - Backend Pricing Calculation (Phase 2C)
/**
 * Fetch calculated pricing from PricingEngine (backend SSOT)
 * Includes all rules: discounts, surcharges, add-ons
 * 
 * Phase 2C: Frontend Migration - use this instead of calculateLineTotal()
 */
export interface PricingRequest {
  items: Array<{
    productId: string;
    adultPax: number;
    childPax: number;
    quantity?: number;
    addonIds?: string[];
    date?: string;  // ISO date string for seasonal rules
  }>;
}

export interface PricingSnapshot {
  items: Array<{
    productId: string;
    adultPax: number;
    childPax: number;
    quantity: number;
    addonIds: string[];
    breakdown: {
      baseTotalCents: number;
      adultSubtotalCents: number;
      childSubtotalCents: number;
      addonsSubtotalCents: number;
      discountsCents: number;
      surchargesCents: number;
      finalTotalCents: number;
      appliedRules: string[];
    };
  }>;
  totalCents: number;
  timestamp: string;
}

export async function fetchPricing(request: PricingRequest): Promise<PricingSnapshot> {
  const res = await apiRequest("POST", "/api/cart/price", request);
  return res.json();
}

// Pricing Versions (Phase 5)
export async function fetchPricingVersions(productId: string): Promise<any[]> {
  const res = await apiRequest("GET", `/api/admin/pricing/${productId}`);
  return res.json();
}

export async function createPricingVersion(data: { productId: string; effectiveFrom: string; adultPriceCents: number; childPriceCents?: number; ruleMetadata?: any }): Promise<any> {
  const res = await apiRequest("POST", `/api/admin/pricing`, data);
  return res.json();
}

// Availability API (Phase 3)
export interface AvailabilityCheckRequest {
  productId: string;
  date: string;
  adultPax: number;
  childPax: number;
  addonIds?: string[];
  startTime?: string;
  endTime?: string;
}

export interface AvailabilityCheckResponse {
  isAvailable: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  message: string;
  /** True when the booking cutoff window has passed for the selected date */
  bookingClosed?: boolean;
  /** ISO timestamp when the booking window closed */
  bookingClosedAt?: string;
  pricing?: any;
}

export async function checkAvailability(req: AvailabilityCheckRequest): Promise<AvailabilityCheckResponse> {
  const res = await apiRequest("POST", "/api/availability/check", {
    serviceId: req.productId,
    date: req.date,
    adultPax: req.adultPax,
    childPax: req.childPax,
    addonIds: req.addonIds,
    startTime: req.startTime,
    endTime: req.endTime
  });
  return res.json();
}

export async function getAvailabilityRange(
  productId: string,
  startDate: string,
  endDate: string,
  minGuests?: number
): Promise<Record<string, { isAvailable: boolean; remainingCapacity: number; totalCapacity: number }>> {
  const qs = new URLSearchParams({ productId, startDate, endDate });
  if (minGuests !== undefined) qs.set('minGuests', String(minGuests));
  const res = await apiRequest("GET", `/api/availability/range?${qs.toString()}`);
  return res.json();
}

// Capacity Audit Log (Phase 7)
export async function fetchAuditLogs(filters?: { productId?: string; action?: string; limit?: number; offset?: number }) {
  const qs = new URLSearchParams();
  if (filters?.productId) qs.set('productId', filters.productId);
  if (filters?.action) qs.set('action', filters.action);
  if (filters?.limit) qs.set('limit', String(filters.limit));
  if (filters?.offset) qs.set('offset', String(filters.offset));
  const res = await apiRequest("GET", `/api/admin/audit-log?${qs.toString()}`);
  return res.json();
}

// Admin Action Audit Log — tracks admin mutations (gateway, flags, settings, recovery)
export async function fetchAdminActionLog(filters?: {
  action?: string;
  entityType?: string;
  entityId?: string;
  performedBy?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = new URLSearchParams();
  if (filters?.action) qs.set('action', filters.action);
  if (filters?.entityType) qs.set('entityType', filters.entityType);
  if (filters?.entityId) qs.set('entityId', filters.entityId);
  if (filters?.performedBy) qs.set('performedBy', filters.performedBy);
  if (filters?.from) qs.set('from', filters.from);
  if (filters?.to) qs.set('to', filters.to);
  if (filters?.limit) qs.set('limit', String(filters.limit));
  if (filters?.offset) qs.set('offset', String(filters.offset));
  const res = await apiRequest("GET", `/api/admin/admin-audit-log?${qs.toString()}`);
  return res.json();
}


export async function fetchAvailableSlots(
  productId: string,
  date: string,
  guests: number
): Promise<{ time: string; available: boolean; remaining: number }[]> {
  const res = await apiRequest("GET", `/api/availability/slots?serviceId=${productId}&date=${date}&guests=${guests}`);
  return res.json();
}

// Admin Availability
export async function upsertAvailability(data: {
  tourId: string;
  date: string;
  timeSlot?: string;
  startTime?: string;
  endTime?: string;
  totalCapacity: number;
  blockedCount?: number;
}): Promise<any> {
  const res = await apiRequest("POST", "/api/admin/availability", data);
  return res.json();
}

export async function deleteAvailability(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/admin/availability/${id}`);
}

export async function fetchTourInstances(tourId: string, date: string): Promise<any[]> {
  const res = await apiRequest("GET", `/api/availability?tourId=${tourId}&date=${date}`);
  return res.json();
}

// Product Translation Admin Helpers
export async function fetchProductTranslations(productId: string): Promise<any[]> {
  const res = await apiRequest("GET", `/api/admin/products/${productId}/translations`);
  return res.json();
}

export async function saveProductTranslation(
  productId: string,
  locale: string,
  fields: Record<string, any>,
): Promise<void> {
  await apiRequest("PUT", `/api/admin/products/${productId}/translations/${locale}`, fields);
}

export async function autoTranslateProduct(productId: string): Promise<{ ok: boolean; message: string }> {
  const res = await apiRequest("POST", `/api/admin/products/${productId}/auto-translate`);
  return res.json();
}
