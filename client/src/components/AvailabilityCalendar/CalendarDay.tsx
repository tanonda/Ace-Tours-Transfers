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
  const currentBookings = day.totalCapacity - day.remainingCapacity;
  const capacityPercent = day.totalCapacity > 0 ? Math.round(
    (currentBookings / day.totalCapacity) * 100
  ) : 0;

  const getAvailabilityStatus = () => {
    if (!day.isAvailable) return 'full';
    if (day.remainingCapacity <= 3 && day.remainingCapacity > 0) return 'limited';
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
    const price = day.basePrice ?? 18000;
    if (price < 17000) return 'low-season';
    if (price < 20000) return 'regular-season';
    return 'high-season';
  };

  const getTierLabel = () => {
    const price = (day.basePrice ?? 18000) / 100;
    if (price < 170) return 'Low';
    if (price < 200) return 'Reg';
    return 'High';
  };

  return (
    <button
      className={`calendar-day ${getAvailabilityStatus()} ${isSelected ? 'selected' : ''
        } ${day.isHoliday ? 'holiday' : ''}`}
      onClick={onClick}
      title={`${day.date} - ${day.remainingCapacity} seats available`}
    >
      <div className="day-number">{dayNum}</div>
      <div className="day-status">{getAvailabilityIcon()}</div>
      <div className={`day-price tier-${getTierColor()}`}>
        {day.basePrice ? `€${Math.round(day.basePrice / 100)}` : '-'}
      </div>
      <div className="day-capacity">
        {day.remainingCapacity}/{day.totalCapacity}
      </div>
      {day.surchargeApplies && <div className="surcharge-badge">!</div>}
    </button>
  );
};
