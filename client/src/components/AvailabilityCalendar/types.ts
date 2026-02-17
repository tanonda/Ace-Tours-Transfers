export interface CalendarDayData {
  date: string; // YYYY-MM-DD format
  isAvailable: boolean;
  totalCapacity: number;
  remainingCapacity: number;
  dayOfWeek: number;
  basePrice?: number;
  priceTier?: 'low' | 'regular' | 'high';
  isHoliday?: boolean;
  surchargeApplies?: boolean;
}

export interface Participants {
  adults: number;
  children: number;
}

export interface AvailabilityCalendarProps {
  tourId: string;
  minDate?: Date;
  maxDate?: Date;
  selectedDate?: string;
  participants: Participants;
  onDateSelect: (date: string) => void;
  onTimeSelect?: (time: string) => void;
  disabledDates?: string[];
}
