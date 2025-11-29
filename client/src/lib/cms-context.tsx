import { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface ContentBlock {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, any> | null;
  updatedAt: string;
}

interface SiteSetting {
  id: string;
  key: string;
  value: Record<string, any>;
  updatedAt: string;
}

interface CMSContextType {
  contentBlocks: ContentBlock[];
  siteSettings: SiteSetting[];
  isBlockEnabled: (slug: string) => boolean;
  getBlockConfig: (slug: string) => Record<string, any> | null;
  getSetting: (key: string) => Record<string, any> | null;
  isLoading: boolean;
  refetch: () => void;
}

const CMSContext = createContext<CMSContextType | undefined>(undefined);

async function fetchContentBlocks(): Promise<ContentBlock[]> {
  const response = await fetch("/api/content-blocks");
  if (!response.ok) throw new Error("Failed to fetch content blocks");
  return response.json();
}

async function fetchSiteSettings(): Promise<SiteSetting[]> {
  const response = await fetch("/api/settings");
  if (!response.ok) throw new Error("Failed to fetch site settings");
  return response.json();
}

export function CMSProvider({ children }: { children: ReactNode }) {
  const { 
    data: contentBlocks = [], 
    isLoading: blocksLoading,
    refetch: refetchBlocks
  } = useQuery({
    queryKey: ["content-blocks"],
    queryFn: fetchContentBlocks,
    staleTime: 5 * 60 * 1000,
  });

  const { 
    data: siteSettings = [], 
    isLoading: settingsLoading,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSiteSettings,
    staleTime: 5 * 60 * 1000,
  });

  const isBlockEnabled = (slug: string): boolean => {
    const block = contentBlocks.find(b => b.slug === slug);
    return block?.enabled ?? true;
  };

  const getBlockConfig = (slug: string): Record<string, any> | null => {
    const block = contentBlocks.find(b => b.slug === slug);
    return block?.config ?? null;
  };

  const getSetting = (key: string): Record<string, any> | null => {
    const setting = siteSettings.find(s => s.key === key);
    return setting?.value ?? null;
  };

  const refetch = () => {
    refetchBlocks();
    refetchSettings();
  };

  return (
    <CMSContext.Provider
      value={{
        contentBlocks,
        siteSettings,
        isBlockEnabled,
        getBlockConfig,
        getSetting,
        isLoading: blocksLoading || settingsLoading,
        refetch
      }}
    >
      {children}
    </CMSContext.Provider>
  );
}

export function useCMS() {
  const context = useContext(CMSContext);
  if (context === undefined) {
    throw new Error("useCMS must be used within a CMSProvider");
  }
  return context;
}

export function useContentBlock(slug: string) {
  const { isBlockEnabled, getBlockConfig, isLoading } = useCMS();
  return {
    enabled: isBlockEnabled(slug),
    config: getBlockConfig(slug),
    isLoading
  };
}
