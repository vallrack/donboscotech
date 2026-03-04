
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

  // Evita errores de hidratación asegurando que el renderizado inicial coincida
  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
    </div>
  );

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-primary font-black text-[10px] uppercase tracking-widest animate-pulse">
            Sincronizando Don Bosco Track...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}

import { Loader2 } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      {children}
    </DashboardGuard>
  );
}
