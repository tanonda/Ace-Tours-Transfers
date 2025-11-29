import React, { createContext, useContext, useState, useCallback } from 'react';

interface SearchResult {
  id: string;
  type: 'booking' | 'tour' | 'customer';
  title: string;
  description: string;
  link: string;
  metadata?: Record<string, any>;
}

interface SearchContextType {
  isOpen: boolean;
  searchResults: SearchResult[];
  searchQuery: string;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const value: SearchContextType = {
    isOpen,
    searchResults,
    searchQuery,
    openSearch,
    closeSearch,
    setSearchQuery,
    setSearchResults,
  };

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return context;
}
