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

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => doc.data() as T);
        setData(items);
        setLoading(false);
        setError(null);
      },
      (serverError: FirestoreError) => {
        // Try to resolve the collection path from the query internal structure for debugging
        const path = (query as any)._query?.path?.toString() || 'unknown_collection';
        
        const permissionError = new FirestorePermissionError({
          path,
          operation: 'list',
        });
        
        setError(permissionError);
        setLoading(false);
        
        if (serverError.code === 'permission-denied') {
          errorEmitter.emit('permission-error', permissionError);
        }
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
