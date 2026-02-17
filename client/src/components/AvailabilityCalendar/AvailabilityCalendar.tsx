"use client";
import React, { useState, useMemo, useEffect, useCallback } from 'react';
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

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = React.memo(({
  tourId,
  onDateSelect,
  onTimeSelect,
  minDate,
  maxDate,
  selectedDate: propSelectedDate,
  participants,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [internalSelectedDate, setInternalSelectedDate] = useState<string | null>(null);
  const activeSelectedDate = propSelectedDate || internalSelectedDate;

  // Sync currentMonth when propSelectedDate changes to show the pre-filled date
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

  const { data, loading } = useCalendarData({
    tourId,
    month,
    year,
    minGuests: totalGuests || 1,
  });

  const calendar = useMemo(() => {
    const days: (CalendarDayData | null)[] = [];
    const firstDay = new Date(year, month, 1).getDay();
    const numDays = new Date(year, month + 1, 0).getDate();

    // Empty cells before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Days of month
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

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  }, []);

  const canGoBack = useMemo(() => !minDate || currentMonth > minDate, [minDate, currentMonth]);
  const canGoForward = useMemo(() => !maxDate || currentMonth < maxDate, [maxDate, currentMonth]);

  const handleDateClick = useCallback((dateStr: string) => {
    setInternalSelectedDate(dateStr);
    onDateSelect(dateStr);
  }, [onDateSelect]);

  const handleTimeSelect = useCallback((time: string) => {
    console.log("Selected time:", time);
    onTimeSelect?.(time);
  }, [onTimeSelect]);

  return (
    <div className="availability-calendar">
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            onClick={goToPreviousMonth}
            disabled={!canGoBack}
            aria-label="Previous month"
          >
            ‹
          </button>
        </div>

        <h3 className="calendar-title">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>

        <div className="calendar-nav">
          <button
            onClick={goToNextMonth}
            disabled={!canGoForward}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>

      {loading && (
        <div className="calendar-loading">
          <div className="spinner" />
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
            <h4 className="legend-title">Availability</h4>
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
        />
      )}
    </div>
  );
});

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
