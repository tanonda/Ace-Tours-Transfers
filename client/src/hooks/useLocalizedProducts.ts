/**
 * client/src/hooks/useLocalizedProducts.ts   ← NEW FILE
 *
 * Drop-in replacement hooks for the three most common product query patterns.
 * These hooks embed i18n.language in the React Query key, so switching the
 * language in the LanguageSelector automatically triggers a re-fetch and the
 * dialogs/cards update without any extra wiring.
 *
 * Usage:
 *
 *   // Instead of:
 *   const { data: products } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
 *
 *   // Use:
 *   const { data: products } = useLocalizedProducts();
 *
 *   // Instead of:
 *   const { data: tour } = useQuery({ queryKey: ["tour", id], queryFn: () => fetchTour(id!) });
 *
 *   // Use:
 *   const { data: tour } = useLocalizedProduct(id);
 */

import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchProducts, fetchProduct } from "@/lib/api";
import type { Product } from "@shared/schema";

// ─── All products (tours, transfers, vehicles) ────────────────────────────────

export function useLocalizedProducts() {
  const { i18n } = useTranslation();

  return useQuery<Product[]>({
    // Language in the key → React Query treats each locale as a distinct cache entry.
    queryKey: ["products", i18n.language],
    queryFn:  fetchProducts,
    staleTime: 5 * 60 * 1000, // 5 min — translations don't change mid-session
  });
}

// ─── Single product / tour / transfer / vehicle ───────────────────────────────

export function useLocalizedProduct(id: string | undefined) {
  const { i18n } = useTranslation();

  return useQuery<Product>({
    queryKey:  ["product", id, i18n.language],
    queryFn:   () => fetchProduct(id!),
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Convenience: tours only ──────────────────────────────────────────────────

export function useLocalizedTours() {
  const result = useLocalizedProducts();
  return {
    ...result,
    data: result.data?.filter((p) => p.category === "tour"),
  };
}

// ─── Convenience: transfers only ─────────────────────────────────────────────

export function useLocalizedTransfers() {
  const result = useLocalizedProducts();
  return {
    ...result,
    data: result.data?.filter((p) => p.category === "transfer"),
  };
}

// ─── Convenience: vehicles only ───────────────────────────────────────────────

export function useLocalizedVehicles() {
  const result = useLocalizedProducts();
  return {
    ...result,
    data: result.data?.filter((p) => p.category === "vehicle"),
  };
}
