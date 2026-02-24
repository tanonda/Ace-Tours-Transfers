"use client";
// Fix #18: All imports moved to top of file per module conventions
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CalendarDay } from './CalendarDay';
import { useCalendarData } from './useCalendarData';
import { TimeSlotPicker } from './TimeSlotPicker';
import { fetchAvailableSlots } from '@/lib/api';
import type { AvailabilityCalendarProps, CalendarDayData } from './types';
import './AvailabilityCalendar.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = React.memo(({
  tourId,
  onDateSelect,
  onTimeSelect,
  minDate,
  maxDate,
  selectedDate: propSelectedDate,
  selectedTime: propSelectedTime,
  participants,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null);
  const activeSelectedDate = propSelectedDate || internalSelectedDate;

  useEffect(() => {
    if (propSelectedDate) {
      const date = new Date(propSelectedDate);
      if (!isNaN(date.getTime())) {
        setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    }
  }, [propSelectedDate]);

  const month = currentMonth.getMonth();
  const year = currentMonth.getFullYear();

  const totalGuests = useMemo(() => {
    return (participants?.adults || 0) + (participants?.children || 0);
  }, [participants]);

  const { data, loading } = useCalendarData({ tourId, month, year, minGuests: totalGuests || 1 });

  const calendar = useMemo(() => {
    const days: (CalendarDayData | null)[] = [];
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) days.push(null);

    for (let i = 1; i <= numDays; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
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
  }, [year, month, data]);

  // Compute month summary stats
  const monthStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDays = calendar.filter(d => {
      if (!d) return false;
      const cellDate = new Date(d.date + 'T00:00:00');
      return cellDate >= today;
    }) as CalendarDayData[];

    const available = futureDays.filter(d => d.isAvailable && d.remainingCapacity > 3).length;
    const limited = futureDays.filter(d => d.isAvailable && d.remainingCapacity > 0 && d.remainingCapacity <= 3).length;
    const full = futureDays.filter(d => !d.isAvailable).length;
    return { available, limited, full };
  }, [calendar]);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  }, []);

  // Fix #20: Use >= / <= so the boundary month itself remains navigable
  const canGoBack = useMemo(() => !minDate || currentMonth >= minDate, [minDate, currentMonth]);
  const canGoForward = useMemo(() => !maxDate || currentMonth <= maxDate, [maxDate, currentMonth]);

  const handleDateClick = useCallback((dateStr: string) => {
    setInternalSelectedDate(dateStr);
    onDateSelect(dateStr);
  }, [onDateSelect]);

  const handleTimeSelect = useCallback((time: string) => {
    onTimeSelect?.(time);
  }, [onTimeSelect]);

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button onClick={goToPreviousMonth} disabled={!canGoBack} aria-label="Previous month">‹</button>
        </div>
        <h3 className="calendar-title">{MONTHS[month]} {year}</h3>
        <div className="calendar-nav">
          <button onClick={goToNextMonth} disabled={!canGoForward} aria-label="Next month">›</button>
        </div>
      </div>

      {!loading && (monthStats.available > 0 || monthStats.limited > 0 || monthStats.full > 0) && (
        <div className="calendar-month-summary">
          {monthStats.available > 0 && (
            <div className="month-summary-item">
              <div className="month-summary-dot green" />
              <span className="month-summary-count">{monthStats.available}</span>
              <span>open</span>
            </div>
          )}
          {monthStats.available > 0 && monthStats.limited > 0 && <span className="month-summary-sep">·</span>}
          {monthStats.limited > 0 && (
            <div className="month-summary-item">
              <div className="month-summary-dot amber" />
              <span className="month-summary-count">{monthStats.limited}</span>
              <span>limited</span>
            </div>
          )}
          {monthStats.limited > 0 && monthStats.full > 0 && <span className="month-summary-sep">·</span>}
          {monthStats.full > 0 && (
            <div className="month-summary-item">
              <div className="month-summary-dot red" />
              <span className="month-summary-count">{monthStats.full}</span>
              <span>full</span>
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="calendar-loading">
          <div className="spinner" />
          <span>Loading availability…</span>
        </div>
      )}

      {!loading && (
        <>
          <div className="calendar-weekdays">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>

          <div className="calendar-grid">
            {calendar.map((day, idx) => (
              <div key={idx} style={{ display: 'contents' }}>
                {day ? (
                  <CalendarDay
                    day={day}
                    isSelected={activeSelectedDate === day.date}
                    onClick={() => handleDateClick(day.date)}
                  />
                ) : (
                  <div className="calendar-day empty" />
                )}
              </div>
            ))}
          </div>

          <div className="calendar-legend">
            <h4 className="legend-title">Key</h4>
            <div className="legend-items">
              <div className="legend-item">
                <div className="legend-color available" />
                <span>Available</span>
              </div>
              <div className="legend-item">
                <div className="legend-color limited" />
                <span>Limited</span>
              </div>
              <div className="legend-item">
                <div className="legend-color full" />
                <span>Full</span>
              </div>
            </div>
          </div>
        </>
      )}

      {activeSelectedDate && (
        <TimeSlotsSection
          tourId={tourId}
          date={activeSelectedDate}
          onTimeSelect={handleTimeSelect}
          guests={totalGuests}
          initialSelectedTime={propSelectedTime}
        />
      )}
    </div>
  );
});

AvailabilityCalendar.displayName = 'AvailabilityCalendar';


const TimeSlotsSection: React.FC<{
  tourId: string;
  date: string;
  onTimeSelect: (time: string) => void;
  guests: number;
  initialSelectedTime?: string | null;
}> = ({ tourId, date, onTimeSelect, guests, initialSelectedTime }) => {
  const [slots, setSlots] = useState<{ time: string; available: boolean; remaining: number }[]>([]);
  const [loading, setLoading] = useState(false);
  // Fix #11: Track and display slot loading errors instead of silently swallowing them
  const [slotError, setSlotError] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(initialSelectedTime || null);

  // Keep selectedTime in sync with initialSelectedTime (from URL params / parent)
  useEffect(() => {
    if (initialSelectedTime) {
      setSelectedTime(initialSelectedTime);
    }
  }, [initialSelectedTime]);

  const loadSlots = async (timeToRestore?: string | null) => {
    setLoading(true);
    setSlotError(null);
    try {
      const data = await fetchAvailableSlots(tourId, date, guests);
      setSlots(data);
      // After slots load, pre-select the time from URL params if still relevant
      if (timeToRestore) {
        setSelectedTime(timeToRestore);
        // Don't re-fire onTimeSelect – parent already has this value from URL
      }
    } catch (error) {
      console.error("Failed to load slots", error);
      setSlotError("Could not load available times. Please try again.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // When date changes, preserve any initialSelectedTime from parent (URL param)
    // but clear interactively-set time if no initial value provided
    const timeToRestore = initialSelectedTime || null;
    if (!initialSelectedTime) {
      setSelectedTime(null);
    }
    loadSlots(timeToRestore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourId, date, guests]);

  if (slotError) {
    return (
      <div className="calendar-slot-error">
        <p className="slot-error-message">{slotError}</p>
        <button
          className="slot-retry-btn"
          onClick={() => loadSlots()}
          aria-label="Retry loading time slots"
        >
          Retry
        </button>
      </div>
    );
  }

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
