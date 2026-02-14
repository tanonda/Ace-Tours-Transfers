export interface AvailabilityStatusProps {
  tourId: string;
  selectedDate: Date;
  adultPax: number;
  childPax: number;
  addonIds?: string[];
  startTime?: string;
  endTime?: string;
  onAvailabilityChange?: (isAvailable: boolean) => void;
}

export interface AvailabilityData {
  isAvailable: boolean;
  remainingCapacity: number;
  totalCapacity: number;
  message: string;
}
