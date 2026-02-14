import { useEffect, useState } from 'react';
import type { CalendarDayData } from './types';

interface UseCalendarDataParams {
  tourId: string;
  month: number;
  year: number;
  participants: number;
}

export const useCalendarData = ({
  tourId,
  month,
  year,
  participants,
}: UseCalendarDataParams) => {
  const [data, setData] = useState<CalendarDayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          month: String(month),
          year: String(year),
          participants: String(participants),
        });

        const response = await fetch(
          `/api/tours/${tourId}/calendar?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch calendar data: ${response.status}`);
        }

        const result = await response.json();
        setData(result.data || []);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load calendar';
        setError(message);
        console.error('Calendar data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [tourId, month, year, participants]);

  return { data, loading, error };
};
