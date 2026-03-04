'use client';

import { useMemo, DependencyList } from 'react';

/**
 * A custom hook that memoizes a Firebase reference or query.
 * This is crucial to prevent infinite re-render loops when passing
 * dynamically created queries to useCollection or useDoc.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
