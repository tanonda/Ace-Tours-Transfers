import React from 'react';
import { formatCurrency } from '../PricingBreakdown/price-formatting';
import type { CalendarDayData } from './types';

interface CalendarDayProps {
  day: CalendarDayData;
  isSelected: boolean;
  onClick: () => void;
}

export const CalendarDay = React.memo(({
  day,
  isSelected,
  onClick,
}: CalendarDayProps) => {
  const dayNum = parseInt(day.date.split('-')[2]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cellDate = new Date(day.date + 'T00:00:00');
  const isPast = cellDate < today;

  const getAvailabilityStatus = () => {
    if (isPast) return 'past';
    if (!day.isAvailable) return 'full';
    if (day.remainingCapacity <= 3 && day.remainingCapacity > 0) return 'limited';
    return 'available';
  };

  const status = getAvailabilityStatus();
  const isDisabled = isPast || !day.isAvailable;

  return (
    <button
      className={`calendar-day ${status} ${isSelected ? 'selected' : ''}`}
      onClick={!isDisabled ? onClick : undefined}
      disabled={isDisabled}
      title={isPast ? 'Past date' : `${day.date} - ${day.remainingCapacity} seats available`}
    >
      <span className="day-number">{dayNum}</span>
      {!isPast && <div className="day-status-dot" />}
      {!isPast && (
        <span className="day-capacity">
          {day.remainingCapacity}/{day.totalCapacity}
        </span>
      )}
    </button>
  );
});

CalendarDay.displayName = 'CalendarDay';
