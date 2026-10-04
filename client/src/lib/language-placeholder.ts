import type { Query } from "@tanstack/react-query";

/**
 * placeholderData for queries keyed `[...keyWithoutLanguage, language]`: while the
 * data in a newly selected language loads, keep showing the same item in the old
 * language instead of a loading state (e.g. right after a prerendered English page
 * hydrates and switches to the visitor's language). Different items never borrow
 * each other's data.
 */
// T defaults to any so the factory never takes part in useQuery's type inference.
export function keepAcrossLanguageSwitch<T = any>(keyWithoutLanguage: readonly unknown[]) {
  return (previousData: T | undefined, previousQuery: Query<any, any, any, any> | undefined): T | undefined => {
    const previousKey = previousQuery?.queryKey;
    if (previousData === undefined || !previousKey) return undefined;
    const sameItem =
      previousKey.length === keyWithoutLanguage.length + 1 &&
      keyWithoutLanguage.every((part, i) => part === previousKey[i]);
    return sameItem ? previousData : undefined;
  };
}
