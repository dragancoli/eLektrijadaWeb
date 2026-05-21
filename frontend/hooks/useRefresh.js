// hooks/useRefresh.js
import { useState, useCallback } from "react";

/**
 * Custom hook za pull-to-refresh funkcionalnost
 * 
 * @param {Function} fetchFunction - Async funkcija koja učitava podatke
 * @returns {Object} - { refreshing, onRefresh }
 * 
 * @example
 * const { refreshing, onRefresh } = useRefresh(loadData);
 * 
 * <ScrollView
 *   refreshControl={
 *     <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
 *   }
 * >
 */
export const useRefresh = (fetchFunction) => {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (Array.isArray(fetchFunction)) {
        // Ako je proslijeđen niz funkcija, izvrši sve paralelno
        await Promise.all(fetchFunction.map(fn => fn()));
      } else {
        await fetchFunction();
      }
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchFunction]);

  return { refreshing, onRefresh };
};

export default useRefresh;
