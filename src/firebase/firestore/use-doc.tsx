'use client';

import { useEffect, useState } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    if (!docRef) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.data() || null);
        setLoading(false);
      },
      async (serverError: FirestoreError) => {
        const permissionError = new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
        });
        setError(permissionError);
        setLoading(false);
        errorEmitter.emit('permission-error', permissionError);
      }
    );

    return () => unsubscribe();
  }, [docRef?.path]);

  return { data, loading, error };
}
