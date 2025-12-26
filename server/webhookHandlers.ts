import { getStripeSync } from './stripeClient';
import { db } from './db';
import { bookings, payments } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'This usually means express.json() parsed the body before reaching this handler. ' +
        'FIX: Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    const event = await sync.processWebhook(payload, signature);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      
      if (bookingId) {
        await db.update(bookings)
          .set({ status: 'confirmed' })
          .where(eq(bookings.id, bookingId));

        await db.update(payments)
          .set({ 
            status: 'completed',
            gatewayReference: session.payment_intent as string,
            updatedAt: new Date()
          })
          .where(eq(payments.bookingId, bookingId));
      }
    }

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      const bookingId = paymentIntent.metadata?.bookingId;
      
      if (bookingId) {
        await db.update(payments)
          .set({ 
            status: 'failed',
            gatewayResponse: paymentIntent.last_payment_error 
          })
          .where(eq(payments.bookingId, bookingId));
      }
    }
  }
}
