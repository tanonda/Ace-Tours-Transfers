
import { Cart } from "./Cart";
import { PriceSnapshot } from "../pricing/PricingService";
import { eventDispatcher } from "../../infrastructure/events/event-dispatcher";
import { BookingCreated } from "../events";

export enum BookingStatus {
  CREATED = 'CREATED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED'
}

export interface BookingProps {
  id: string;
  cartId: string;
  customerName: string;
  customerEmail: string;
  amount: number;
  status: BookingStatus;
  createdAt: Date;
}

export class Booking {
  private props: BookingProps;

  constructor(props: BookingProps) {
    this.validate(props);
    this.props = { ...props };
  }

  private validate(props: BookingProps): void {
    if (!props.customerEmail || !props.customerEmail.includes('@')) {
      throw new Error("Guest email is mandatory and must be valid");
    }
    if (props.amount <= 0) {
      throw new Error("Booking amount must be greater than zero");
    }
  }

  public static createFromCart(id: string, cart: Cart, customer: { name: string; email: string }): Booking {
    cart.validate();
    const snapshot = cart.getPricedSnapshot();
    if (!snapshot) {
      throw new Error("Booking must originate from a priced Cart");
    }

    const booking = new Booking({
      id,
      cartId: cart.id,
      customerName: customer.name,
      customerEmail: customer.email,
      amount: snapshot.total,
      status: BookingStatus.CREATED,
      createdAt: new Date()
    });

    // Domain Event happens after successful creation logic
    // Usually handled by the application service to ensure persistence first
    return booking;
  }

  public awaitPayment(): void {
    if (this.props.status !== BookingStatus.CREATED) {
      throw new Error(`Cannot transition to AWAITING_PAYMENT from ${this.props.status}`);
    }
    this.props.status = BookingStatus.AWAITING_PAYMENT;
  }

  public confirm(): void {
    // Invariant: Booking cannot be confirmed without being in a state that allows it
    if (this.props.status !== BookingStatus.AWAITING_PAYMENT) {
      throw new Error(`Cannot confirm booking in state ${this.props.status}`);
    }
    this.props.status = BookingStatus.CONFIRMED;
  }

  public cancel(): void {
    if (this.props.status === BookingStatus.CONFIRMED) {
      throw new Error("Cannot cancel a confirmed booking through standard domain logic");
    }
    this.props.status = BookingStatus.CANCELLED;
  }

  public get id(): string { return this.props.id; }
  public get status(): BookingStatus { return this.props.status; }
  public get amount(): number { return this.props.amount; }
  public get customerEmail(): string { return this.props.customerEmail; }
  public get customerName(): string { return this.props.customerName; }
}
