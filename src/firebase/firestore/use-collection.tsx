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
 * Utiliza el errorEmitter centralizado para manejar fallos de permisos.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    // Si la consulta es nula (ej. cargando auth), no hacemos nada.
    if (!query) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          ...(doc.data() as any),
          id: doc.id,
        }) as T);
        setData(items);
        setLoading(false);
        setError(null);
      },
      (serverError: FirestoreError) => {
        // Extraemos la ruta para el error contextual si es posible
        const path = (query as any)._query?.path?.toString() || 'colección_desconocida';
        
        const permissionError = new FirestorePermissionError({
          path,
          operation: 'list',
        });
        
        setError(permissionError);
        setLoading(false);
        
        // Emitimos el error solo si es falta de permisos para activar el listener global
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', permissionError);
        }
      }
    );

    return () => unsubscribe();
  }, [query]); // query debe estar memorizado con useMemoFirebase en el componente

  return { data, loading, error };
}
