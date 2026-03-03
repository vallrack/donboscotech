"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, QrCode, ClipboardCheck, BarChart3, Menu, X, User } from 'lucide-react';
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
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['docent', 'coordinator', 'admin'] },
    { name: 'Registrar QR', href: '/attendance/scan', icon: QrCode, roles: ['docent'] },
    { name: 'Marcaje Manual', href: '/attendance/manual', icon: ClipboardCheck, roles: ['coordinator', 'admin'] },
    { name: 'Reportes', href: '/reports', icon: BarChart3, roles: ['coordinator', 'admin'] },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user.role));

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex-shrink-0 flex items-center gap-2">
              <Image 
                src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                alt="Logo"
                width={120}
                height={33}
                className="h-8 w-auto"
              />
              <span className="text-primary font-bold text-lg hidden sm:block">Track</span>
            </Link>
            <div className="hidden md:ml-8 md:flex md:space-x-4">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors h-16",
                    pathname === item.href
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-primary hover:border-gray-300"
                  )}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          
          <div className="hidden md:ml-4 md:flex md:items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full text-xs font-medium">
              <User className="w-3 h-3" />
              <span className="text-foreground capitalize">{user.role}: {user.name}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-primary">
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>

          <div className="flex items-center md:hidden">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t p-4 space-y-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-base font-medium",
                pathname === item.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-gray-50"
              )}
            >
              <item.icon className="w-5 h-5 mr-3" />
              {item.name}
            </Link>
          ))}
          <div className="pt-4 border-t mt-4">
             <div className="flex items-center px-3 py-2 text-sm text-muted-foreground mb-4">
                <User className="w-4 h-4 mr-2" />
                <span className="capitalize">{user.role}: {user.name}</span>
             </div>
            <Button variant="outline" className="w-full justify-start" onClick={logout}>
              <LogOut className="w-5 h-5 mr-3" /> Cerrar Sesión
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}