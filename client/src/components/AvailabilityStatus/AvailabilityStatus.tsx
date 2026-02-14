import React from 'react';
import { useAvailabilityData } from './useAvailabilityData';
import type { AvailabilityStatusProps } from './types';
import './AvailabilityStatus.css';

export const AvailabilityStatus: React.FC<AvailabilityStatusProps> = ({
  tourId,
  selectedDate,
  maxParticipants,
  onAvailabilityChange,
}) => {
  const { data, loading, error } = useAvailabilityData(tourId, selectedDate);

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

  if (!data) {
    return null;
  }

  const { isAvailable, availableSeats, totalCapacity, currentBookings } = data;
  const capacityPercent = Math.round((currentBookings / totalCapacity) * 100);
  const seatsRemaining = availableSeats;
  const isSoon = seatsRemaining <= 3 && seatsRemaining > 0;

  React.useEffect(() => {
    onAvailabilityChange?.(isAvailable);
  }, [isAvailable, onAvailabilityChange]);

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
              backgroundColor: isAvailable ? '#10b981' : '#ef4444',
            }}
          />
        </div>
      </div>

      {isAvailable && (
        <div className="seats-remaining">
          <p>{seatsRemaining} seats available</p>
          {isSoon && <p className="warning">⚠️ Booking soon!</p>}
        </div>
      )}

      {!isAvailable && (
        <div className="fully-booked">
          <p>This date is fully booked. Please select another date.</p>
        </div>
      )}
    </div>
  );
};

export default AvailabilityStatus;
