import { useState, useEffect, useCallback } from "react";

function getChatUrl(p: string): string {
  if (typeof window === "undefined") return p;
  return `${window.location.protocol}//${window.location.hostname}:4001${p}`;
}

export interface Priorities {
  bets: string[];
  ideasWithoutBets: string[];
  epicsWithoutIdeas: string[];
}

export function usePriorities() {
  const [priorities, setPriorities] = useState<Priorities>({
    bets: [],
    ideasWithoutBets: [],
    epicsWithoutIdeas: [],
  });

  useEffect(() => {
    fetch(getChatUrl("/api/priorities"))
      .then((r) => r.json())
      .then(setPriorities)
      .catch(console.error);
  }, []);

  const updateList = useCallback(
    async (list: keyof Priorities, order: string[]) => {
      setPriorities((prev) => ({ ...prev, [list]: order }));
      try {
        const res = await fetch(getChatUrl(`/api/priorities/${list}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order }),
        });
        if (res.ok) {
          const updated = await res.json();
          setPriorities(updated);
        }
      } catch (err) {
        console.error("Failed to update priorities:", err);
      }
    },
    []
  );

  return { priorities, updateList };
}

/**
 * Sort an array of items by a priority order list.
 * Items in the order list come first (in that order), then remaining items in original order.
 */
export function sortByPriority<T>(items: T[], getKey: (item: T) => string, order: string[]): T[] {
  if (order.length === 0) return items;
  const orderMap = new Map(order.map((key, idx) => [key, idx]));
  return [...items].sort((a, b) => {
    const aIdx = orderMap.get(getKey(a));
    const bIdx = orderMap.get(getKey(b));
    if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
    if (aIdx !== undefined) return -1;
    if (bIdx !== undefined) return 1;
    return 0; // preserve original order for unprioritized items
  });
}
