
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher.js";
import { PaymentInitiated, PaymentConfirmed, PaymentFailed, PaymentExpired } from "../events.js";

export enum PaymentIntentStatus {
  PENDING = 'PENDING',
  RECEIVED = 'RECEIVED',
  FAILED = 'FAILED'
}

export interface PaymentIntentProps {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  method: string;
  provider: string;
}

export class PaymentIntent {
  private props: PaymentIntentProps;

  constructor(props: PaymentIntentProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: PaymentIntentProps): void {
    if (props.method === props.provider) {
      // Invariant: Method != Provider (e.g., Method=Card, Provider=Stripe)
      throw new Error("Payment method and provider must be distinct");
    }
    if (props.amount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }
  }

  public static initiate(id: string, bookingId: string, amount: number, method: string, provider: string): PaymentIntent {
    const intent = new PaymentIntent({
      id,
      bookingId,
      amount,
      currency: 'USD', // Default
      status: PaymentIntentStatus.PENDING,
      method,
      provider
    });

    // Domain Event
    eventDispatcher.dispatch(new PaymentInitiated(intent.id, intent.bookingId, intent.amount));

    return intent;
  }

  public receive(): void {
    if (this.props.status !== PaymentIntentStatus.PENDING) {
      throw new Error(`Cannot receive payment in status ${this.props.status}`);
    }
    this.props.status = PaymentIntentStatus.RECEIVED;

    // Domain Event for side effects (like confirming booking)
    eventDispatcher.dispatch(new PaymentConfirmed(this.props.id, this.props.bookingId));
  }

  public fail(reason: string): void {
    if (this.props.status !== PaymentIntentStatus.PENDING) {
      throw new Error(`Cannot fail payment in status ${this.props.status}`);
    }
    this.props.status = PaymentIntentStatus.FAILED;
    console.log(`[PAYMENT][FAILED] Intent ${this.props.id} failed: ${reason}`);

    if (reason === 'expired_timeout') {
      eventDispatcher.dispatch(new PaymentExpired(this.props.id, this.props.bookingId));
    } else {
      eventDispatcher.dispatch(new PaymentFailed(this.props.id, this.props.bookingId, reason));
    }
  }

  public get id(): string { return this.props.id; }
  public get bookingId(): string { return this.props.bookingId; }
  public get status(): PaymentIntentStatus { return this.props.status; }
  public get amount(): number { return this.props.amount; }
}
