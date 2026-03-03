"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { MOCK_ATTENDANCE } from '@/lib/mock-data';
import { Clock, CheckCircle2, AlertTriangle, Users, CalendarDays, ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // Filter attendance based on role
  const records = user?.role === 'docent' 
    ? MOCK_ATTENDANCE.filter(r => r.userId === user.id)
    : MOCK_ATTENDANCE;

  const stats = [
    { 
      label: user?.role === 'docent' ? 'Horas esta semana' : 'Docentes presentes hoy', 
      value: user?.role === 'docent' ? '32h' : '12/15', 
      icon: Clock, 
      color: 'text-primary' 
    },
    { 
      label: 'Puntualidad General', 
      value: '94%', 
      icon: CheckCircle2, 
      color: 'text-green-600' 
    },
    { 
      label: 'Registros Pendientes', 
      value: '2', 
      icon: AlertTriangle, 
      color: 'text-yellow-600' 
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Bienvenido, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'docent' 
              ? 'Aquí tienes un resumen de tu actividad de asistencia.' 
              : 'Vista general del estado de asistencia de la institución.'}
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'docent' ? (
            <Link href="/attendance/scan">
              <Card className="hover:bg-primary/5 transition-colors cursor-pointer border-primary/20 bg-white">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Marcar Ahora</p>
                    <p className="text-xs text-muted-foreground">Escanear código QR</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ) : (
            <Link href="/reports">
              <Card className="hover:bg-primary/5 transition-colors cursor-pointer border-primary/20 bg-white">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">Generar Reporte</p>
                    <p className="text-xs text-muted-foreground">Análisis de horas</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm bg-white">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-3xl font-bold">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-none bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-primary" />
              Actividad Reciente
            </CardTitle>
            <CardDescription>
              Últimos registros de entrada y salida detectados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
                      record.type === 'entry' ? "bg-green-500" : "bg-primary"
                    )}>
                      {record.type === 'entry' ? 'E' : 'S'}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{record.userName}</p>
                      <p className="text-xs text-muted-foreground">{record.date} a las {record.time}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={record.method === 'QR' ? 'secondary' : 'outline'} className="text-[10px] h-5">
                      {record.method}
                    </Badge>
                  </div>
                </div>
              ))}
              {records.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No hay actividad reciente.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Notificaciones Institucionales
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <div className="p-6 hover:bg-gray-50 transition-colors">
                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Mantenimiento</p>
                <h4 className="font-semibold mb-2">Actualización de Lector QR</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  El próximo lunes se actualizarán los terminales de acceso. Por favor use el marcaje manual si tiene inconvenientes.
                </p>
              </div>
              <div className="p-6 hover:bg-gray-50 transition-colors">
                <p className="text-xs text-primary font-bold uppercase tracking-wider mb-1">Recordatorio</p>
                <h4 className="font-semibold mb-2">Cierre de Nómina Octubre</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  Asegúrese de validar todas sus horas antes del 28 de octubre para el procesamiento correcto de honorarios.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 p-4 text-center">
              <Link href="#" className="text-sm font-semibold text-primary flex items-center justify-center gap-1">
                Ver todo el boletín <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}