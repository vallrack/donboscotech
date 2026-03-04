
"use client"

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Redirección automática al sistema de reportes real dentro del dashboard.
 * Evita la confusión con datos de ejemplo (mock data).
 */
export default function ReportsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/reports');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
      <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
      <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
        Cargando Auditoría Real...
      </p>
    </div>
  );
}
