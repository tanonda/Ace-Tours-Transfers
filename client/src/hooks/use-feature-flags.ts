import { useQuery } from "@tanstack/react-query";
import { fetchFeatureFlags } from "@/lib/api";

export function useFeatureFlags() {
  const { data: flags = [], isLoading } = useQuery({
    queryKey: ["feature-flags"],
    queryFn: fetchFeatureFlags,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isEnabled = (slug: string) => {
    const flag = flags.find(f => f.slug === slug);
    return flag ? flag.enabled : false;
  };

  return {
    flags,
    isLoading,
    isEnabled,
  };
}
