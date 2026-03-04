import { formatPriceDisplay } from "./product.types";

export interface PaymentRequest {
  bookingId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  description: string;
}

export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  redirectUrl?: string;
  error?: string;
  gatewayResponse?: any;
}

export interface PaymentGateway {
  id: string;
  slug: string;
  displayName: string;
  active: boolean;
  isDefault: boolean;
}

export async function getActivePaymentGateway(): Promise<PaymentGateway | null> {
  try {
    const response = await fetch('/api/payment-gateways/active');
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function initiatePayment(
  request: PaymentRequest,
  gatewaySlug: string
): Promise<PaymentResponse> {
  try {
    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...request,
        gatewaySlug
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Payment initiation failed' };
    }

    return response.json();
  } catch (error) {
    return { success: false, error: 'Network error. Please try again.' };
  }
}

export async function checkPaymentStatus(paymentId: string): Promise<{
  status: 'pending' | 'completed' | 'failed';
  message?: string;
}> {
  try {
    const response = await fetch(`/api/payments/${paymentId}/status`);
    if (!response.ok) {
      return { status: 'pending', message: 'Unable to check status' };
    }
    return response.json();
  } catch {
    return { status: 'pending', message: 'Network error' };
  }
}
/**
 * Formats currency for display in cart and payment views.
 * @deprecated Use formatPriceShort from product.types.ts for new code
 */
export function formatCurrency(amount: number, currency: string = 'VUV'): string {
  if (currency === 'VUV') {
    return formatPriceDisplay(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: currency === 'VUV' ? 0 : 2
  }).format(amount);
}

