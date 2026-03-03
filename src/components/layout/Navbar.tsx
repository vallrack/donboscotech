"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, QrCode, ClipboardCheck, BarChart3, Menu, X, User, Users, Settings, CreditCard } from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
    { name: 'Mi Carnet', href: '/dashboard/profile/carnet', icon: CreditCard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
    { name: 'Registrar QR', href: '/dashboard/attendance/scan', icon: QrCode, roles: ['docent', 'admin'] },
    { name: 'Marcaje Manual', href: '/dashboard/attendance/manual', icon: ClipboardCheck, roles: ['coordinator', 'admin', 'secretary'] },
    { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['coordinator', 'admin', 'secretary'] },
    { name: 'Personal', href: '/dashboard/admin/users', icon: Users, roles: ['admin', 'coordinator'] },
    { name: 'Configuración', href: '/dashboard/admin/settings', icon: Settings, roles: ['admin', 'coordinator'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-4 xl:gap-8 flex-1 overflow-hidden">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-3 group">
              <Image 
                src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                alt="Ciudad Don Bosco"
                width={140}
                height={38}
                className="h-9 w-auto"
              />
              <div className="h-6 w-px bg-gray-200 hidden md:block" />
              <span className="text-primary font-black text-xl tracking-tighter hidden md:block group-hover:text-primary/80 transition-colors">Track</span>
            </Link>
            
            <div className="hidden xl:flex xl:gap-1 h-full items-center overflow-x-auto no-scrollbar">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center px-3 py-2 text-xs font-bold transition-all relative whitespace-nowrap",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-2 shrink-0" />
                    {item.name}
                    {isActive && <div className="absolute bottom-[-1.5rem] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                  </Link>
                );
              })}
            </div>

            {/* Versión compacta para pantallas grandes pero no extra grandes */}
            <div className="hidden lg:flex xl:hidden gap-1 h-full items-center">
              {filteredNavItems.slice(0, 4).map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "inline-flex items-center px-3 py-2 text-xs font-bold transition-all relative whitespace-nowrap",
                      isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {isActive && <div className="absolute bottom-[-1.5rem] left-0 right-0 h-1 bg-primary rounded-t-full" />}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="hidden lg:flex lg:items-center gap-2 xl:gap-4 flex-shrink-0 ml-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full border border-gray-200 max-w-[180px] xl:max-w-xs overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-[10px] xl:text-xs font-bold text-gray-700 truncate">
                 {user.name}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-primary transition-all font-bold px-2 xl:px-3">
              <LogOut className="w-4 h-4 xl:mr-2" /> 
              <span className="hidden xl:inline">Salir</span>
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
              <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-primary" />
                <span className="font-bold text-sm truncate">{user.name}</span>
              </div>
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
