
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, QrCode, ClipboardCheck, BarChart3, Menu, X, User, Users, Settings, CreditCard } from 'lucide-react';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Memoize filtered items to prevent redundant renders and infinite loops
  const filteredNavItems = useMemo(() => {
    if (!user) return [];
    
    const allItems = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
      { name: 'Mi Perfil', href: '/dashboard/profile', icon: User, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
      { name: 'Mi Carnet', href: '/dashboard/profile/carnet', icon: CreditCard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
      { name: 'Registrar QR', href: '/dashboard/attendance/scan', icon: QrCode, roles: ['docent', 'admin'] },
      { name: 'Marcaje Manual', href: '/dashboard/attendance/manual', icon: ClipboardCheck, roles: ['coordinator', 'admin', 'secretary'] },
      { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['coordinator', 'admin', 'secretary'] },
      { name: 'Personal', href: '/dashboard/admin/users', icon: Users, roles: ['admin', 'coordinator'] },
      { name: 'Configuración', href: '/dashboard/admin/settings', icon: Settings, roles: ['admin', 'coordinator'] },
    ];
    
    return allItems.filter(item => item.roles.includes(user.role));
  }, [user?.role]);

  if (!user) return null;

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-6 flex-1">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-3 group">
              <Image 
                src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                alt="Ciudad Don Bosco"
                width={140}
                height={38}
                className="h-9 w-auto"
                priority
              />
              <div className="h-6 w-px bg-gray-200 hidden md:block" />
              <span className="text-primary font-black text-xl tracking-tighter hidden md:block group-hover:text-primary/80 transition-colors">Track</span>
            </Link>
            
            <div className="hidden lg:flex gap-1 h-full items-center">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "group inline-flex items-center px-3 py-2 text-xs font-bold transition-all whitespace-nowrap rounded-xl hover:bg-gray-50",
                          isActive ? "text-primary bg-primary/5" : "text-muted-foreground hover:text-primary"
                        )}
                      >
                        <item.icon className={cn("w-5 h-5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
                        <span className="max-w-0 overflow-hidden group-hover:max-w-[200px] transition-all duration-300 ease-in-out ml-0 group-hover:ml-3 opacity-0 group-hover:opacity-100">
                          {item.name}
                        </span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="font-bold text-[10px] bg-primary text-white border-none shadow-lg">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          
          <div className="hidden lg:flex lg:items-center gap-4 flex-shrink-0 ml-6">
            <Link href="/dashboard/profile" className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 hover:border-primary/20 transition-colors group">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-all overflow-hidden">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt={user.name} width={32} height={32} className="object-cover" unoptimized />
                ) : (
                  <User className="w-4 h-4 text-primary group-hover:text-white" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-800 leading-none truncate max-w-[100px]">
                   {user.name.split(' ')[0]}
                </span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  {user.role}
                </span>
              </div>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={logout} 
              className="text-gray-400 hover:text-primary hover:bg-primary/5 transition-all rounded-xl h-10 w-10"
            >
              <LogOut className="w-5 h-5" /> 
            </Button>
          </div>

          <div className="flex items-center lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-primary">
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t animate-in slide-in-from-top duration-300">
          <div className="p-4 space-y-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl text-base font-bold",
                  pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-gray-50"
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}
            <div className="pt-4 border-t mt-4">
              <Button variant="destructive" className="w-full justify-start h-12 rounded-xl font-bold" onClick={logout}>
                <LogOut className="w-5 h-5 mr-3" /> Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
