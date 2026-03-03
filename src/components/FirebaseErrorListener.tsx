'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // In production, we show a generic friendly message.
      // In development, we surface the exact path and operation that failed.
      const isDev = process.env.NODE_ENV === 'development';
      
      toast({
        variant: 'destructive',
        title: 'Error de Seguridad (Firestore)',
        description: isDev 
          ? `Acceso denegado: ${error.context.operation} en la ruta [${error.context.path}]`
          : 'No tienes permisos suficientes para ver esta información.',
      });
      
      if (isDev) {
        // Detailed log for the developer to fix security rules
        console.group('🔥 Firestore Security Denied');
        console.error('Operation:', error.context.operation);
        console.error('Path:', error.context.path);
        if (error.context.requestResourceData) {
          console.error('Data attempted:', error.context.requestResourceData);
        }
        console.groupEnd();
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
