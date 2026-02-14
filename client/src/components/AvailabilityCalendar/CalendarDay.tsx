import React from 'react';
import { formatCurrency } from '../PricingBreakdown/price-formatting';
import type { CalendarDayData } from './types';

interface CalendarDayProps {
  day: CalendarDayData;
  isSelected: boolean;
  onClick: () => void;
}

export const CalendarDay: React.FC<CalendarDayProps> = ({
  day,
  isSelected,
  onClick,
}) => {
  const dayNum = parseInt(day.date.split('-')[2]);
  const capacityPercent = Math.round(
    (day.currentBookings / day.totalCapacity) * 100
  );

  const getAvailabilityStatus = () => {
    if (!day.isAvailable) return 'full';
    if (day.availableSeats <= 3 && day.availableSeats > 0) return 'limited';
    return 'available';
  };

  const getAvailabilityIcon = () => {
    const status = getAvailabilityStatus();
    switch (status) {
      case 'available':
        return '🟢';
      case 'limited':
        return '🟡';
      case 'full':
        return '🔴';
      default:
        return '⚪';
    }
  };

  const getTierColor = () => {
    const price = day.basePrice;
    if (price < 17000) return 'low-season';
    if (price < 20000) return 'regular-season';
    return 'high-season';
  };

  const getTierLabel = () => {
    const price = day.basePrice / 100;
    if (price < 170) return 'Low';
    if (price < 200) return 'Reg';
    return 'High';
  };

  return (
    <button
      className={`calendar-day ${getAvailabilityStatus()} ${
        isSelected ? 'selected' : ''
      } ${day.isHoliday ? 'holiday' : ''}`}
      onClick={onClick}
      title={`${day.date} - ${day.availableSeats} seats available`}
    >
      <div className="day-number">{dayNum}</div>
      <div className="day-status">{getAvailabilityIcon()}</div>
      <div className={`day-price tier-${getTierColor()}`}>
        €{Math.round(day.basePrice / 100)}
      </div>
      <div className="day-capacity">
        {day.availableSeats}/{day.totalCapacity}
      </div>
      {day.surchargeApplies && <div className="surcharge-badge">!</div>}
    </button>
  );
};
