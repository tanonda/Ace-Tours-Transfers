export interface CalendarDayData {
  date: string; // YYYY-MM-DD format
  isAvailable: boolean;
  totalCapacity: number;
  currentBookings: number;
  availableSeats: number;
  basePrice: number; // in cents
  priceTier: 'low' | 'regular' | 'high';
  isHoliday: boolean;
  surchargeApplies: boolean;
}

export interface AvailabilityCalendarProps {
  tourId: string;
  minDate?: Date;
  maxDate?: Date;
  participants: number;
  onDateSelect: (date: string) => void;
  disabledDates?: string[];
}
