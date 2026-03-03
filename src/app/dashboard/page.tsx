
"use client"

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, limit, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, AlertTriangle, Users, CalendarDays, ArrowRight, BarChart3, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceRecord } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);
  
  const recordsQuery = useMemo(() => {
    if (!db || !user) return null;
    if (user.role === 'docent') {
      return query(
        collection(db, 'userProfiles', user.id, 'attendanceRecords'),
        orderBy('date', 'desc'),
        limit(5)
      );
    } else {
      return query(
        collection(db, 'globalAttendanceRecords'),
        orderBy('date', 'desc'),
        limit(10)
      );
    }
  }, [db, user]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery as any);

  const stats = [
    { 
      id: 'stat-hours',
      label: user?.role === 'docent' ? 'Horas esta semana' : 'Docentes presentes hoy', 
      value: user?.role === 'docent' ? '32h' : 'Real-time', 
      icon: Clock, 
      color: 'text-primary' 
    },
    { 
      id: 'stat-punctuality',
      label: 'Puntualidad General', 
      value: '94%', 
      icon: CheckCircle2, 
      color: 'text-green-600' 
    },
    { 
      id: 'stat-pending',
      label: 'Registros Pendientes', 
      value: '0', 
      icon: AlertTriangle, 
      color: 'text-yellow-600' 
    },
  ];

  const handleClaimAdmin = async () => {
    if (!db || !user) return;
    setClaiming(true);
    try {
      const adminRef = doc(db, 'roles_admins', user.id);
      await setDoc(adminRef, { 
        email: user.email, 
        grantedAt: serverTimestamp(),
        grantedBy: 'system_bootstrap'
      });
      
      const profileRef = doc(db, 'userProfiles', user.id);
      await setDoc(profileRef, { role: 'admin' }, { merge: true });
      
      toast({
        title: "Rol de Administrador Activado",
        description: "Ahora tienes privilegios administrativos completos.",
      });
      
      window.location.reload();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al reclamar rol",
        description: "Asegúrate de no tener un rol previo o contacta soporte.",
      });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary flex items-center gap-3">
            Bienvenido, {user?.name.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">
            {user?.role === 'admin' 
              ? 'Panel de control administrativo institucional.' 
              : `Panel de control para el rol de ${user?.role}.`}
          </p>
        </div>
        <div className="flex gap-3">
          {/* Permitimos el botón de QR para docents y admins para facilitar pruebas */}
          {(user?.role === 'docent' || user?.role === 'admin') && (
            <Link href="/dashboard/attendance/scan">
              <Button size="lg" className="h-14 px-8 shadow-xl font-bold rounded-2xl bg-primary hover:bg-primary/90">
                <Clock className="w-5 h-5 mr-2" /> Marcar Asistencia (QR)
              </Button>
            </Link>
          )}
          {user?.role !== 'docent' && (
            <Link href="/dashboard/reports">
              <Button variant="outline" size="lg" className="h-14 px-8 shadow-md font-bold rounded-2xl bg-white border-gray-200">
                <BarChart3 className="w-5 h-5 mr-2" /> Reportes Administrativos
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Solo mostramos la opción de reclamar admin si el usuario es docent (rol base) */}
      {user?.role === 'docent' && (
        <Card className="border-none bg-primary shadow-2xl shadow-primary/20 text-white rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Configuración Inicial
            </CardTitle>
            <CardDescription className="text-primary-foreground/80 text-base">
              Si eres el administrador principal del sistema, activa tus privilegios aquí.
            </CardDescription>
          </CardHeader>
          <CardFooter className="relative z-10">
            <Button variant="secondary" size="lg" onClick={handleClaimAdmin} disabled={claiming} className="font-bold rounded-xl h-12">
              {claiming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reclamar Rol de Administrador
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => (
          <Card key={stat.id} className="border-none shadow-xl shadow-gray-200/50 bg-white rounded-3xl p-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-4xl font-black">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-xl border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 pb-6">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 bg-primary/10 rounded-xl">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              Actividad en Tiempo Real
            </CardTitle>
            <CardDescription className="text-base">
              Últimos registros sincronizados con la base de datos.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {recordsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-5 rounded-2xl border bg-gray-50/30 hover:bg-gray-50 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg transition-transform group-hover:scale-105",
                        record.type === 'entry' ? "bg-green-500 shadow-lg shadow-green-200" : "bg-primary shadow-lg shadow-primary/20"
                      )}>
                        {record.type === 'entry' ? 'E' : 'S'}
                      </div>
                      <div>
                        <p className="font-bold text-base leading-none text-gray-800">{record.userName}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" /> {record.date} • {record.time}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={record.method === 'QR' ? 'secondary' : 'outline'} className="text-[10px] uppercase font-black px-3 py-1 rounded-lg">
                        {record.method}
                      </Badge>
                    </div>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="text-center py-20 text-muted-foreground bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                    <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-10" />
                    <p className="text-base font-medium">No se encontraron registros recientes.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-xl border-none bg-white rounded-3xl overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 pb-6">
            <CardTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Avisos del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              <div className="p-8 hover:bg-gray-50 transition-all cursor-pointer group">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-2">Mantenimiento</p>
                <h4 className="font-black text-base mb-2 group-hover:text-primary transition-colors">Sincronización de Base de Datos</h4>
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Estamos integrando las colecciones de roles dinámicos. Tu sesión es ahora 100% persistente y segura.
                </p>
              </div>
              <div className="p-8 hover:bg-gray-50 transition-all cursor-pointer group">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-2">Seguridad</p>
                <h4 className="font-black text-base mb-2 group-hover:text-primary transition-colors">Verificación de GPS</h4>
                <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                  Recuerda que los registros deben realizarse dentro de los perímetros autorizados de Ciudad Don Bosco.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 p-6 text-center border-t border-primary/10">
              <Link href="#" className="text-sm font-black text-primary flex items-center justify-center gap-2 hover:gap-3 transition-all">
                Ver historial completo <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
