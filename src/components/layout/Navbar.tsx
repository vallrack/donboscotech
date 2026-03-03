
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, QrCode, ClipboardCheck, BarChart3, Menu, X, User, Users } from 'lucide-react';
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
    { name: 'Registrar QR', href: '/dashboard/attendance/scan', icon: QrCode, roles: ['docent'] },
    { name: 'Marcaje Manual', href: '/dashboard/attendance/manual', icon: ClipboardCheck, roles: ['coordinator', 'admin', 'secretary'] },
    { name: 'Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['coordinator', 'admin', 'secretary'] },
    { name: 'Personal', href: '/dashboard/admin/users', icon: Users, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-3 group">
              <Image 
                src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                alt="Ciudad Don Bosco"
                width={140}
                height={38}
                className="h-10 w-auto"
              />
              <div className="h-6 w-px bg-gray-200 hidden sm:block" />
              <span className="text-primary font-black text-xl tracking-tighter hidden sm:block group-hover:text-primary/80 transition-colors">Track</span>
            </Link>
            
            <div className="hidden lg:flex lg:space-x-1 h-full">
              {filteredNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center px-4 text-sm font-semibold transition-all relative h-full",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground hover:text-primary"
                    )}
                  >
                    <item.icon className="w-4 h-4 mr-2" />
                    {item.name}
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          
          <div className="hidden lg:flex lg:items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-100 rounded-full border border-gray-200">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-xs font-bold text-gray-700">
                <span className="capitalize text-muted-foreground font-medium">{user.role}:</span> {user.name}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={logout} 
              className="text-gray-500 hover:text-primary hover:bg-primary/5 transition-all font-bold"
            >
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>

          <div className="flex items-center lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-primary">
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </div>

      {/* Menú Mobile */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t animate-in slide-in-from-top duration-300">
          <div className="p-4 space-y-2">
            {filteredNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center px-4 py-3 rounded-xl text-base font-bold transition-all",
                  pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-gray-50"
                )}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}
            <div className="pt-4 border-t mt-4">
              <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-gray-50 rounded-xl">
                <User className="w-5 h-5 text-primary" />
                <span className="font-bold text-sm capitalize">{user.role}: {user.name}</span>
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
