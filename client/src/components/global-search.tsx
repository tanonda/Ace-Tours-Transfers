import { useEffect, useMemo } from 'react';
import { useSearch } from '@/lib/search-context';
import { useQuery } from '@tanstack/react-query';
import { fetchBookings, fetchTours } from '@/lib/api';
import { useLocation } from 'wouter';

export function GlobalSearch() {
  const { isOpen, closeSearch, searchQuery, setSearchQuery, setSearchResults } = useSearch();
  const [, setLocation] = useLocation();
  const { data: bookings = [] } = useQuery({ queryKey: ["bookings"], queryFn: fetchBookings });
  const { data: tours = [] } = useQuery({ queryKey: ["tours"], queryFn: fetchTours });

  // Search across all data
  const results = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    const matches: any[] = [];

    // Search bookings
    bookings.forEach(b => {
      if (b.customerName?.toLowerCase().includes(query) ||
          b.tourName?.toLowerCase().includes(query) ||
          b.id?.toLowerCase().includes(query) ||
          b.amount?.toLowerCase().includes(query) ||
          b.date?.toLowerCase().includes(query)) {
        matches.push({
          id: b.id,
          type: 'booking',
          title: `Booking #${b.id?.slice(0, 6)}`,
          description: `${b.customerName} - ${b.tourName} (${b.date})`,
          link: '/admin/bookings',
          metadata: b
        });
      }
    });

    // Search tours
    tours.forEach(t => {
      if (t.title?.toLowerCase().includes(query) ||
          t.price?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query)) {
        matches.push({
          id: t.id,
          type: 'tour',
          title: t.title,
          description: `${t.category} - ${t.price}`,
          link: '/tours',
          metadata: t
        });
      }
    });

    return matches.slice(0, 10);
  }, [searchQuery, bookings, tours]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const search = useSearch();
        search.openSearch();
      }
      if (e.key === 'Escape' && isOpen) {
        closeSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 flex items-start justify-center pt-20">
      <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-2xl">
        <div className="p-4 border-b border-border">
          <input
            autoFocus
            type="text"
            placeholder="Search bookings, tours, customers... (Cmd+K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-foreground text-lg outline-none"
          />
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="divide-y divide-border">
              {results.map(result => (
                <button
                  key={result.id}
                  onClick={() => {
                    setLocation(result.link);
                    closeSearch();
                  }}
                  className="w-full p-4 text-left hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-foreground">{result.title}</div>
                      <div className="text-sm text-muted-foreground">{result.description}</div>
                    </div>
                    <div className="text-xs px-2 py-1 rounded bg-primary/20 text-primary-foreground">
                      {result.type}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="p-8 text-center text-muted-foreground">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Start typing to search bookings, tours, and more...
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground flex justify-between">
          <span>Press ESC to close</span>
          <span>Cmd+K to search from anywhere</span>
        </div>
      </div>
    </div>
  );
}
