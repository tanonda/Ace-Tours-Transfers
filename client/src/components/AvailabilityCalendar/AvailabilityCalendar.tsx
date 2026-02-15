import React, { useState, useMemo } from 'react';
import { CalendarDay } from './CalendarDay';
import { useCalendarData } from './useCalendarData';
import type { AvailabilityCalendarProps, CalendarDayData } from './types';
import './AvailabilityCalendar.css';

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  tourId,
  onDateSelect,
  onTimeSelect,
  minDate,
  maxDate,
  participants,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data, loading } = useCalendarData({
    tourId,
    month: currentMonth.getMonth(),
    year: currentMonth.getFullYear(),
  });

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const calendar = useMemo(() => {
    const days: (CalendarDayData | null)[] = [];
    const firstDay = firstDayOfMonth(currentMonth);
    const numDays = daysInMonth(currentMonth);

    // Empty cells before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of month
    for (let i = 1; i <= numDays; i++) {
      const dateStr = `${currentMonth.getFullYear()}-${String(
        currentMonth.getMonth() + 1
      ).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

      const dayData = data[dateStr];
      days.push({
        date: dateStr,
        dayOfWeek: (firstDay + i - 1) % 7,
        isAvailable: dayData?.isAvailable ?? true,
        totalCapacity: dayData?.totalCapacity ?? 0,
        remainingCapacity: dayData?.remainingCapacity ?? 0,
        basePrice: 0,
        priceTier: 'regular',
        isHoliday: false,
        surchargeApplies: false,
      });
    }

    return days;
  }, [currentMonth, data]);

  const goToPreviousMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1)
    );
  };

  const goToNextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1)
    );
  };

  const canGoBack = !minDate || currentMonth > minDate;
  const canGoForward = !maxDate || currentMonth < maxDate;

  const handleDateClick = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    setSelectedDate(dateStr);
    onDateSelect(dateStr);
  };

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            onClick={goToPreviousMonth}
            disabled={!canGoBack}
          >
            ← Previous
          </button>
          <button
            onClick={goToNextMonth}
            disabled={!canGoForward}
          >
            Next →
          </button>
        </div>

        <h3 className="calendar-title">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
      </div>

      {loading && (
        <div className="calendar-loading">
          <div className="spinner" />
        </div>
      )}

      {!loading && (
        <>
          {/* Days of week header */}
          <div className="calendar-weekdays">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days grid */}
          <div className="calendar-grid">
            {calendar.map((day, idx) => (
              <div key={idx}>
                {day ? (
                  <CalendarDay
                    day={day}
                    isSelected={selectedDate === day.date}
                    onClick={() => handleDateClick(day.date)}
                  />
                ) : (
                  <div />
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="calendar-legend">
            <h4 className="legend-title">Availability Legend</h4>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color available">🟢</div>
                <span>Available (4+ seats)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color limited">🟡</div>
                <span>Limited (1-3 seats)</span>
              </div>
              <div className="legend-item">
                <div className="legend-color full">🔴</div>
                <span>Full (Booked out)</span>
              </div>
            </div>
          </div>

          {/* Pricing tiers */}
          <div className="pricing-tiers">
            <h4 className="tiers-title">Price Tiers</h4>
            <div className="tiers-grid">
              <div className="tier-badge tier-low">
                <div>Low Season</div>
                <div style={{ fontSize: '10px' }}>€150-170</div>
              </div>
              <div className="tier-badge tier-regular">
                <div>Regular</div>
                <div style={{ fontSize: '10px' }}>€180-190</div>
              </div>
              <div className="tier-badge tier-high">
                <div>High Season</div>
                <div style={{ fontSize: '10px' }}>€250+</div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedDate && (
        <TimeSlotsSection
          tourId={tourId}
          date={selectedDate}
          onTimeSelect={(time) => {
            // For now just log it, we need to pass this up
            console.log("Selected time:", time);
            // Verify if onDateSelect can handle time? No, it expects string date.
            // We might need a new prop onTimeSelect
          }}
          guests={participants}
        />
      )}
    </div>
  );
};

// Internal component for handling slot logic to avoid cluttering main calendar
import { TimeSlotPicker } from "./TimeSlotPicker";
import { fetchAvailableSlots } from "@/lib/api";

const TimeSlotsSection: React.FC<{
  tourId: string;
  date: string;
  onTimeSelect: (time: string) => void;
  guests: number;
}> = ({ tourId, date, onTimeSelect, guests }) => {
  const [slots, setSlots] = useState<{ time: string; available: boolean; remaining: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    const loadSlots = async () => {
      setLoading(true);
      try {
        const data = await fetchAvailableSlots(tourId, date, guests);
        setSlots(data);
      } catch (error) {
        console.error("Failed to load slots", error);
      } finally {
        setLoading(false);
      }
    };
    loadSlots();
  }, [tourId, date, guests]);

  return (
    <TimeSlotPicker
      slots={slots}
      selectedTime={selectedTime}
      onSelect={(time) => {
        setSelectedTime(time);
        onTimeSelect(time);
      }}
      isLoading={loading}
    />
  );
};

export default AvailabilityCalendar;
