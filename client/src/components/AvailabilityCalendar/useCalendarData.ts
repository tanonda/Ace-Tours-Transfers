import { useEffect, useState } from 'react';
import { getAvailabilityRange } from '../../lib/api';
import { startOfMonth, endOfMonth, format } from 'date-fns';

interface UseCalendarDataParams {
  tourId: string;
  month: number; // 0-indexed
  year: number;
}

export const useCalendarData = ({
  tourId,
  month,
  year,
}: UseCalendarDataParams) => {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCalendarData = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseDate = new Date(year, month, 1);
        const startDate = format(startOfMonth(baseDate), 'yyyy-MM-dd');
        const endDate = format(endOfMonth(baseDate), 'yyyy-MM-dd');

        const result = await getAvailabilityRange(tourId, startDate, endDate);
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load calendar';
        setError(message);
        console.error('Calendar data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tourId) {
      fetchCalendarData();
    }
  }, [tourId, month, year]);

  return { data, loading, error };
};
