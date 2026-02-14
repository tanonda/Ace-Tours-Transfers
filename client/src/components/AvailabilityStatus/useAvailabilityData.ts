import { useState, useEffect } from 'react';
import type { AvailabilityData } from './types';

export function useAvailabilityData(tourId: string, selectedDate: Date) {
  const [data, setData] = useState<AvailabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvailability = async () => {
      try {
        setLoading(true);
        setError(null);

        const dateStr = selectedDate.toISOString().split('T')[0];
        const response = await fetch(
          `/api/availability/${tourId}?date=${dateStr}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch availability');
        }

        const availabilityData = await response.json();
        setData(availabilityData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailability();

    // Poll every 30 seconds for real-time updates
    const interval = setInterval(fetchAvailability, 30000);
    return () => clearInterval(interval);
  }, [tourId, selectedDate]);

  return { data, loading, error };
}
