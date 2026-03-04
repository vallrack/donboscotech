'use client';

import { useEffect, useState } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

/**
 * Hook para suscribirse a una colección o consulta de Firestore en tiempo real.
 * Utiliza un solo objeto de estado para evitar múltiples re-renders y estabilizar
 * la referencia inicial del array de datos, previniendo bucles infinitos.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [state, setState] = useState<{
    data: T[];
    loading: boolean;
    error: FirestorePermissionError | null;
  }>({
    data: [],      // Referencia estable inicial
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!query) {
      setState(prev => prev.loading ? { ...prev, loading: false } : prev);
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          ...(doc.data() as any),
          id: doc.id,
        }) as T);
        setState({ data: items, loading: false, error: null });
      },
      (serverError: FirestoreError) => {
        const path = (query as any)._query?.path?.toString() || 'colección_desconocida';
        const permissionError = new FirestorePermissionError({
          path,
          operation: 'list',
        });
        
        setState(prev => ({ ...prev, error: permissionError, loading: false }));
        
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', permissionError);
        }
      }
    );

    return () => unsubscribe();
  }, [query]);

  return state;
}
