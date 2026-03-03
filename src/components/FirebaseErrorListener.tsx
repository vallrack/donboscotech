'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // In production, we might just show a generic message.
      // In development, this architecture surfaces rich errors to the UI.
      toast({
        variant: 'destructive',
        title: 'Error de Permisos (Firestore)',
        description: `No tienes permiso para realizar esta acción: ${error.context.operation} en ${error.context.path}`,
      });
      
      // We also throw to trigger the Next.js error boundary/overlay in dev
      if (process.env.NODE_ENV === 'development') {
        console.error('Firestore Security Rule Denied:', error.context);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
