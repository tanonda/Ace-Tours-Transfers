"use client";
import React, { useEffect } from 'react';
import { useRealtimeAvailability } from '../../hooks/useRealtimeAvailability';
import type { AvailabilityStatusProps } from './types';
import './AvailabilityStatus.css';

export const AvailabilityStatus: React.FC<AvailabilityStatusProps> = ({
  tourId,
  selectedDate,
  adultPax,
  childPax,
  addonIds,
  startTime,
  endTime,
  onAvailabilityChange,
}) => {
  const dateStr = selectedDate.toISOString().split('T')[0];
  const { data, loading, error } = useRealtimeAvailability({
    productId: tourId,
    date: dateStr,
    adultPax,
    childPax,
    addonIds,
    startTime,
    endTime
  });

  useEffect(() => {
    if (data) {
      onAvailabilityChange?.(data.isAvailable);
    }
  }, [data?.isAvailable, onAvailabilityChange]);

  if (loading) {
    return (
      <div className="availability-status loading">
        <div className="spinner" />
        <p>Checking availability…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="availability-status error">
        <p>⚠️ Unable to check availability</p>
      </div>
    );
  }

  if (!data && !loading) return null;

  const { isAvailable, remainingCapacity, totalCapacity, message, bookingClosed } = data || {
    isAvailable: false,
    remainingCapacity: 0,
    totalCapacity: 0,
    message: '',
    bookingClosed: false,
  };

  // Booking window has closed — show a distinct state so users know it's not
  // a capacity issue but a cutoff issue, and can call to book instead.
  if (bookingClosed) {
    return (
      <div className="availability-status full">
        <div className="availability-header">
          <h3>Availability</h3>
          <div className="status-badge full">
            <div className="badge-dot" />
            Booking Closed
          </div>
        </div>
        <div className="status-message">
          <p>🔒 Online booking for this date has closed. Please call or WhatsApp us to check if we can still accommodate you.</p>
        </div>
      </div>
    );
  }

  const currentBookings = totalCapacity - remainingCapacity;
  const capacityPercent = totalCapacity > 0 ? Math.round((currentBookings / totalCapacity) * 100) : 0;
  const isSoon = remainingCapacity <= 3 && remainingCapacity > 0;

  // Dynamic color for progress bar
  const progressColor = isAvailable
    ? (isSoon ? '#f4a830' : '#4caf7d')
    : '#e05555';

  return (
    <div className={`availability-status ${isAvailable ? 'available' : 'full'}`}>
      <div className="availability-header">
        <h3>Availability</h3>
        <div className={`status-badge ${isAvailable ? 'open' : 'full'}`}>
          <div className="badge-dot" />
          {isAvailable ? 'Available' : 'Fully Booked'}
        </div>
      </div>

      {totalCapacity > 0 && (
        <div className="capacity-section">
          <div className="capacity-label">
            <span>{isAvailable ? `${remainingCapacity} of ${totalCapacity} spots left` : 'Sold out'}</span>
            <span className="numbers">{currentBookings}/{totalCapacity}</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${capacityPercent}%`, backgroundColor: progressColor }}
            />
          </div>
        </div>
      )}

      <div className="status-message">
        {message && <p>{message}</p>}
        {isSoon && isAvailable && (
          <p className="warning">🔥 Filling fast — only {remainingCapacity} spot{remainingCapacity !== 1 ? 's' : ''} left!</p>
        )}
      </div>

      {!isAvailable && !loading && (
        <div className="fully-booked">
          <p>Sold out for this selection. Try a different date or time.</p>
        </div>
      )}
    </div>
  );
};

export default AvailabilityStatus;
