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

  if (loading) {
    return (
      <div className="availability-status loading">
        <div className="spinner" />
        <p>Checking availability...</p>
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

  useEffect(() => {
    if (data) {
      onAvailabilityChange?.(data.isAvailable);
    }
  }, [data?.isAvailable, onAvailabilityChange]);

  if (!data && !loading) return null;

  const { isAvailable, remainingCapacity, totalCapacity, message } = data || {
    isAvailable: false,
    remainingCapacity: 0,
    totalCapacity: 0,
    message: ''
  };

  const currentBookings = totalCapacity - remainingCapacity;
  const capacityPercent = totalCapacity > 0 ? Math.round((currentBookings / totalCapacity) * 100) : 0;
  const isSoon = remainingCapacity <= 3 && remainingCapacity > 0;

  return (
    <div className={`availability-status ${isAvailable ? 'available' : 'full'}`}>
      <div className="availability-header">
        <h3>Availability Status</h3>
        <div className={`status-badge ${isAvailable ? 'open' : 'full'}`}>
          {isAvailable ? '🟢 AVAILABLE' : '🔴 FULLY BOOKED'}
        </div>
      </div>

      <div className="capacity-section">
        <div className="capacity-label">
          <span>Capacity</span>
          <span className="numbers">
            {currentBookings}/{totalCapacity}
          </span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${capacityPercent}%`,
              backgroundColor: isAvailable ? '#10b981' : '#f59e0b', // Amber for low capacity
            }}
          />
        </div>
      </div>

      <div className="status-message">
        <p>{message}</p>
        {isSoon && <p className="warning">🔥 Filling fast! Only {remainingCapacity} left.</p>}
      </div>

      {!isAvailable && !loading && (
        <div className="fully-booked">
          <p>Sold out for this selection. Try another date or time.</p>
        </div>
      )}
    </div>
  );
};

export default AvailabilityStatus;
