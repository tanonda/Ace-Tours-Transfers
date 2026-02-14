export interface AvailabilityStatusProps {
  tourId: string;
  selectedDate: Date;
  maxParticipants?: number;
  onAvailabilityChange?: (isAvailable: boolean) => void;
}

export interface AvailabilityData {
  tourId: string;
  date: string;
  totalCapacity: number;
  currentBookings: number;
  isAvailable: boolean;
  availableSeats: number;
}
