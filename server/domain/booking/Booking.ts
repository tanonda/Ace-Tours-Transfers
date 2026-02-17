
import { Cart } from "./Cart.js";
import { PriceSnapshot } from "../pricing/PricingService.js";

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
  amountCents: number;
  status: BookingStatus;
  createdAt: Date;
  pickupLocation?: string;
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
    if (props.amountCents <= 0) {
      throw new Error("Booking amount must be greater than zero");
    }
  }

  public static createFromCart(id: string, cart: Cart, customer: { name: string; email: string; pickupLocation?: string }): Booking {
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
      amountCents: snapshot.totalCents,
      status: BookingStatus.CREATED,
      createdAt: new Date(),
      pickupLocation: customer.pickupLocation
    });

    return booking;
  }

  public awaitPayment(): void {
    if (this.props.status !== BookingStatus.CREATED) {
      throw new Error(`Cannot transition to AWAITING_PAYMENT from ${this.props.status}`);
    }
    this.props.status = BookingStatus.AWAITING_PAYMENT;
  }

  public confirm(): void {
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
  public get amountCents(): number { return this.props.amountCents; }
  public get customerEmail(): string { return this.props.customerEmail; }
  public get customerName(): string { return this.props.customerName; }
}
