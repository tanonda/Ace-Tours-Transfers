// Phase 3 Components - Availability & Pricing UI
export { AvailabilityStatus } from './AvailabilityStatus';
export { PricingBreakdown, RuleExplanation } from './PricingBreakdown';
export {
  AvailabilityCalendar,
  CalendarDay,
} from './AvailabilityCalendar';

// Utilities & Types
export type {
  AvailabilityStatusProps,
  AvailabilityData,
} from './AvailabilityStatus';
export type {
  PricingBreakdownProps,
  PricingSnapshot,
  AppliedRule,
  PricingBreakdownItem,
} from './PricingBreakdown';
export type {
  AvailabilityCalendarProps,
  CalendarDayData,
} from './AvailabilityCalendar';

// Formatting utilities
export { formatCurrency } from './PricingBreakdown/price-formatting';

// Custom hooks
export { useAvailabilityData } from './AvailabilityStatus';
export { useCalendarData } from './AvailabilityCalendar';
