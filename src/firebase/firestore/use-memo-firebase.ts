'use client';

import { useMemo, DependencyList } from 'react';

/**
 * Un hook personalizado que memoriza una referencia o consulta de Firebase.
 * Esto es crucial para prevenir bucles de re-renderizado infinito al pasar
 * consultas creadas dinámicamente a useCollection o useDoc.
 */
export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(factory, deps);
}
