
export interface DomainEvent {
  occurredAt: Date;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly occurredAt: Date;
  public readonly correlationId: string;

  constructor(correlationId?: string) {
    this.occurredAt = new Date();
    this.correlationId = correlationId || `corr_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export class CartPriced extends BaseDomainEvent {
  constructor(
    public readonly cartId: string,
    public readonly total: number,
    public readonly vat: number
  ) {
    super();
  }
}

export class BookingCreated extends BaseDomainEvent {
  constructor(
    public readonly bookingId: string,
    public readonly amount: number
  ) {
    super();
  }
}

export class PaymentInitiated extends BaseDomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly amount: number
  ) {
    super();
  }
}

export class PaymentConfirmed extends BaseDomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string
  ) {
    super();
  }
}
