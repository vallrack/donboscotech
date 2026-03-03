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
        const items = snapshot.docs.map((doc) => doc.data());
        setData(items);
        setLoading(false);
      },
      async (serverError: FirestoreError) => {
        // Since we don't have the direct path from a Query easily in all versions, 
        // we use a generic label or try to extract it.
        const permissionError = new FirestorePermissionError({
          path: 'collection_query',
          operation: 'list',
        });
        setError(permissionError);
        setLoading(false);
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, loading, error };
}
