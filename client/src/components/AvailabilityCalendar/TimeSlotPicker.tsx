"use client";
import React from 'react';
import { Clock } from 'lucide-react';

interface Slot {
  time: string;
  available: boolean;
  remaining: number;
}

interface TimeSlotPickerProps {
  slots: Slot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
  isLoading?: boolean;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedTime,
  onSelect,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(244,168,48,0.18)',
      }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          color: '#4a4438',
          letterSpacing: '0.07em',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <Clock size={10} /> Select Time
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{
              height: '46px',
              background: 'rgba(244,168,48,0.06)',
              borderRadius: '7px',
              animation: 'pulse 1.5s ease infinite',
            }} />
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0) return null;

  return (
    <div style={{
      marginTop: '12px',
      paddingTop: '12px',
      borderTop: '1px solid rgba(244,168,48,0.18)',
    }}>
      <div style={{
        fontSize: '10px',
        fontWeight: 700,
        textTransform: 'uppercase',
        color: '#8a826e',
        letterSpacing: '0.07em',
        marginBottom: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}>
        <Clock size={10} style={{ color: '#f4a830' }} /> Select Time
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '4px',
      }}>
        {slots.map((slot) => {
          const isSelected = selectedTime === slot.time;
          const isDisabled = !slot.available;
          return (
            <button
              key={slot.time}
              onClick={() => slot.available && onSelect(slot.time)}
              disabled={isDisabled}
              title={slot.available ? `${slot.remaining} seats left` : 'Fully booked'}
              style={{
                padding: '7px 4px',
                borderRadius: '7px',
                border: `1.5px solid ${isSelected ? '#f4a830' : 'rgba(244,168,48,0.18)'}`,
                background: isSelected ? '#f4a830' : isDisabled ? 'rgba(244,168,48,0.03)' : 'rgba(244,168,48,0.07)',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.4 : 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 0 0 3px rgba(244,168,48,0.2)' : 'none',
              }}
            >
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isSelected ? '#0f0d09' : '#f0ece4',
                lineHeight: 1,
              }}>
                {slot.time}
              </span>
              <span style={{
                fontSize: '9px',
                color: isSelected ? 'rgba(15,13,9,0.6)' : '#8a826e',
                fontWeight: 600,
              }}>
                {slot.available ? `${slot.remaining} left` : 'Full'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
