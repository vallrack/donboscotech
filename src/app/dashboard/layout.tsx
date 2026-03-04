
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Navbar } from '@/components/layout/Navbar';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isLoading && !user) {
      router.replace('/');
    }
  }, [user, isLoading, router, mounted]);

  // Solo mostramos el spinner en la carga inicial real de la aplicación
  if (!mounted || (isLoading && !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-primary font-black text-[10px] uppercase tracking-widest animate-pulse">
            Sincronizando Sistema...
          </p>
        </div>
      </div>
    );
  }

  if (!user && !isLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      {children}
    </DashboardGuard>
  );
}
