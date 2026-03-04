
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Loader2, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-gray-50/50">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          {/* Top Bar for Context & Mobile */}
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-white px-6 sticky top-0 z-30 no-print">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="lg:hidden" />
              <div className="lg:hidden">
                 <Image 
                    src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                    alt="Logo"
                    width={100}
                    height={28}
                    className="h-7 w-auto"
                 />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-[10px] font-black text-gray-800 leading-none truncate max-w-[150px]">
                   {user.name}
                </span>
                <span className="text-[8px] font-bold text-primary uppercase tracking-widest mt-1">
                  {user.role}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="rounded-xl text-muted-foreground hover:text-destructive transition-colors">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      {children}
    </DashboardGuard>
  );
}
