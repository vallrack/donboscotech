
"use client"

import * as React from "react"
import { 
  LayoutDashboard, 
  User, 
  CreditCard, 
  QrCode, 
  ClipboardCheck, 
  BarChart3, 
  Users, 
  Settings,
  ShieldCheck,
  ChevronRight,
  Megaphone
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const pathname = usePathname()

  const navItems = React.useMemo(() => {
    if (!user) return []
    
    const items = [
      { 
        group: "Principal",
        items: [
          { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
          { name: 'Mi Perfil', href: '/dashboard/profile', icon: User, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
          { name: 'Mi Carnet', href: '/dashboard/profile/carnet', icon: CreditCard, roles: ['docent', 'coordinator', 'secretary', 'admin'] },
        ]
      },
      { 
        group: "Asistencia",
        items: [
          { name: 'Registrar QR', href: '/dashboard/attendance/scan', icon: QrCode, roles: ['docent', 'admin'] },
          { name: 'Marcaje Manual', href: '/dashboard/attendance/manual', icon: ClipboardCheck, roles: ['coordinator', 'admin', 'secretary'] },
          { name: 'Mis Reportes', href: '/dashboard/reports', icon: BarChart3, roles: ['docent'] },
          { name: 'Auditoría', href: '/dashboard/reports', icon: BarChart3, roles: ['coordinator', 'admin', 'secretary'] },
        ]
      },
      { 
        group: "Administración",
        items: [
          { name: 'Gestión Personal', href: '/dashboard/admin/users', icon: Users, roles: ['admin', 'coordinator'] },
          { name: 'Anuncios', href: '/dashboard/admin/announcements', icon: Megaphone, roles: ['admin', 'coordinator', 'secretary'] },
          { name: 'Configuración', href: '/dashboard/admin/settings', icon: Settings, roles: ['admin', 'coordinator'] },
        ]
      }
    ]
    
    return items.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(user.role))
    })).filter(group => group.items.length > 0)
  }, [user?.role])

  return (
    <Sidebar collapsible="icon" className="border-r border-gray-100 bg-white" {...props}>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3 px-2 py-4 border-b border-gray-50 mb-4">
          <div className="flex-shrink-0">
             <Image 
                src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
                alt="Don Bosco"
                width={120}
                height={32}
                className="h-8 w-auto transition-all group-data-[collapsible=icon]:hidden"
                priority
             />
             <div className="hidden group-data-[collapsible=icon]:flex w-8 h-8 items-center justify-center bg-primary rounded-lg text-white font-black">
                D
             </div>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {navItems.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-6 mb-2 group-data-[collapsible=icon]:hidden">
              {group.group}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <SidebarMenuItem key={item.name + item.href}>
                      <SidebarMenuButton 
                        asChild 
                        isActive={isActive}
                        tooltip={item.name}
                        className={cn(
                          "mx-4 w-auto rounded-xl px-4 py-6 transition-all duration-200",
                          isActive 
                            ? "bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90" 
                            : "text-muted-foreground hover:bg-gray-50 hover:text-primary"
                        )}
                      >
                        <Link href={item.href}>
                          <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-current")} />
                          <span className="font-bold text-sm tracking-tight">{item.name}</span>
                          {isActive && <ChevronRight className="ml-auto w-4 h-4 opacity-50" />}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      
      <SidebarFooter className="p-6">
        <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200 group-data-[collapsible=icon]:hidden">
           <div className="flex items-center gap-2 text-primary opacity-60">
             <ShieldCheck className="w-3 h-3" />
             <span className="text-[8px] font-black uppercase tracking-widest">Protocolo Seguro</span>
           </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
