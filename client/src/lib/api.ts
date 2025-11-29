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
  const response = await fetch(`${API_BASE}/bookings/export`);
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
