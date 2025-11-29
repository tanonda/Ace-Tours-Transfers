import type { Tour, Booking, User } from "@shared/schema";

const API_BASE = "/api";

// Tours API
export async function fetchTours(): Promise<Tour[]> {
  const response = await fetch(`${API_BASE}/tours`);
  if (!response.ok) throw new Error("Failed to fetch tours");
  return response.json();
}

export async function fetchTour(id: string): Promise<Tour> {
  const response = await fetch(`${API_BASE}/tours/${id}`);
  if (!response.ok) throw new Error("Failed to fetch tour");
  return response.json();
}

// Bookings API
export async function fetchBookings(): Promise<Booking[]> {
  const response = await fetch(`${API_BASE}/bookings`);
  if (!response.ok) throw new Error("Failed to fetch bookings");
  return response.json();
}

export async function fetchUserBookings(userId: string): Promise<Booking[]> {
  const response = await fetch(`${API_BASE}/bookings/user/${userId}`);
  if (!response.ok) throw new Error("Failed to fetch user bookings");
  return response.json();
}

export async function fetchBooking(id: string): Promise<Booking> {
  const response = await fetch(`${API_BASE}/bookings/${id}`);
  if (!response.ok) throw new Error("Failed to fetch booking");
  return response.json();
}

export async function createBooking(booking: {
  userId: string;
  tourId: string;
  date: string;
  guests: number;
  amount: string;
  status: string;
  customerName: string;
  tourName: string;
}): Promise<Booking> {
  const response = await fetch(`${API_BASE}/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(booking),
  });
  if (!response.ok) throw new Error("Failed to create booking");
  return response.json();
}

export async function updateBooking(id: string, updates: Partial<Booking>): Promise<Booking> {
  const response = await fetch(`${API_BASE}/bookings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update booking");
  return response.json();
}

export async function deleteBooking(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/bookings/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete booking");
}

// Analytics API
export async function fetchBookingStats(): Promise<{
  total: number;
  confirmed: number;
  pending: number;
  completed: number;
}> {
  const response = await fetch(`${API_BASE}/analytics/stats`);
  if (!response.ok) throw new Error("Failed to fetch stats");
  return response.json();
}

export async function fetchRevenue(): Promise<{ month: string; total: number }[]> {
  const response = await fetch(`${API_BASE}/analytics/revenue`);
  if (!response.ok) throw new Error("Failed to fetch revenue");
  return response.json();
}

// Users API
export async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`${API_BASE}/users/${id}`);
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
}

export async function fetchCustomers(): Promise<User[]> {
  const response = await fetch(`${API_BASE}/customers`);
  if (!response.ok) throw new Error("Failed to fetch customers");
  return response.json();
}

// Export bookings as CSV
export async function exportBookingsCSV(): Promise<void> {
  const response = await fetch(`${API_BASE}/bookings/export`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error("Failed to export bookings");
  
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bookings.csv";
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// Wishlist API
export async function fetchWishlist(): Promise<{ id: string; userId: string; tourId: string; addedAt: string }[]> {
  const response = await fetch(`${API_BASE}/wishlist`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch wishlist");
  return response.json();
}

export async function checkWishlist(tourId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/wishlist/check/${tourId}`, { credentials: "include" });
  if (!response.ok) return false;
  const data = await response.json();
  return data.inWishlist;
}

export async function addToWishlist(tourId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/wishlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ tourId }),
  });
  if (!response.ok) throw new Error("Failed to add to wishlist");
}

export async function removeFromWishlist(tourId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/wishlist/${tourId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to remove from wishlist");
}

// Newsletter API
export async function subscribeNewsletter(data: { 
  email: string; 
  name?: string; 
  locale?: string; 
  source?: string 
}): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE}/newsletter/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to subscribe");
  }
  return response.json();
}

export async function fetchNewsletterSubscribers(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/newsletter/subscribers`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch subscribers");
  return response.json();
}

// CMS Content API
export async function fetchCmsContent(blockSlug: string, locale?: string): Promise<any[]> {
  const url = locale 
    ? `${API_BASE}/cms-content/${blockSlug}?locale=${locale}` 
    : `${API_BASE}/cms-content/${blockSlug}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch CMS content");
  return response.json();
}

export async function fetchAllCmsContent(): Promise<Record<string, any[]>> {
  const response = await fetch(`${API_BASE}/cms-content`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to fetch CMS content");
  return response.json();
}

export async function createCmsContent(data: {
  blockSlug: string;
  contentKey: string;
  contentType: string;
  value: string;
  locale?: string;
  sortOrder?: number;
}): Promise<any> {
  const response = await fetch(`${API_BASE}/cms-content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create CMS content");
  return response.json();
}

export async function updateCmsContent(id: string, data: Partial<{
  contentKey: string;
  contentType: string;
  value: string;
  locale: string;
  sortOrder: number;
}>): Promise<any> {
  const response = await fetch(`${API_BASE}/cms-content/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update CMS content");
  return response.json();
}

export async function deleteCmsContent(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/cms-content/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to delete CMS content");
}
