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
  
  // Dynamic query based on role
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
      label: user?.role === 'docent' ? 'Horas esta semana' : 'Docentes presentes hoy', 
      value: user?.role === 'docent' ? '32h' : 'Real-time', 
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
      value: '0', 
      icon: AlertTriangle, 
      color: 'text-yellow-600' 
    },
  ];

  const handleClaimAdmin = async () => {
    if (!db || !user) return;
    setClaiming(true);
    try {
      // Registrar en la colección de roles administrativos
      const adminRef = doc(db, 'roles_admins', user.id);
      await setDoc(adminRef, { 
        email: user.email, 
        grantedAt: serverTimestamp(),
        grantedBy: 'system_bootstrap'
      });
      
      // Actualizar perfil de usuario
      const profileRef = doc(db, 'userProfiles', user.id);
      await setDoc(profileRef, { role: 'admin' }, { merge: true });
      
      toast({
        title: "Rol de Administrador Activado",
        description: "Ahora tienes privilegios administrativos completos.",
      });
      
      // Recargar para aplicar cambios de contexto
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Bienvenido, {user?.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {user?.role === 'docent' 
              ? 'Has iniciado sesión con éxito. Revisa tu historial de asistencia.' 
              : `Panel de control con rol de ${user?.role}.`}
          </p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'docent' ? (
            <Link href="/attendance/scan">
              <Button className="h-12 shadow-md">
                <Clock className="w-5 h-5 mr-2" /> Marcar Asistencia
              </Button>
            </Link>
          ) : (
            <Link href="/reports">
              <Button variant="outline" className="h-12 shadow-sm">
                <BarChart3 className="w-5 h-5 mr-2" /> Reportes Administrativos
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Bootstrap Section for first user */}
      {user?.role === 'docent' && (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Configuración Inicial
            </CardTitle>
            <CardDescription>
              Si eres el administrador principal de boscotech-3231f, activa tus privilegios aquí.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button size="sm" onClick={handleClaimAdmin} disabled={claiming}>
              {claiming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reclamar Rol de Administrador
            </Button>
          </CardFooter>
        </Card>
      )}

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
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="w-5 h-5 text-primary" />
              Actividad en Tiempo Real
            </CardTitle>
            <CardDescription>
              Últimos registros sincronizados con la base de datos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recordsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 rounded-lg border bg-gray-50/50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                        record.type === 'entry' ? "bg-green-500" : "bg-primary"
                      )}>
                        {record.type === 'entry' ? 'E' : 'S'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-none">{record.userName}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">{record.date} • {record.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={record.method === 'QR' ? 'secondary' : 'outline'} className="text-[10px] uppercase font-bold px-2">
                        {record.method}
                      </Badge>
                    </div>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No se encontraron registros recientes.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-none bg-white overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              Avisos del Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              <div className="p-6 hover:bg-gray-50 transition-colors">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">Mantenimiento</p>
                <h4 className="font-bold text-sm mb-2">Sincronización de Base de Datos</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Estamos integrando las colecciones de roles dinámicos. Tu sesión es ahora 100% persistente.
                </p>
              </div>
              <div className="p-6 hover:bg-gray-50 transition-colors">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">Seguridad</p>
                <h4 className="font-bold text-sm mb-2">Verificación de GPS</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Recuerda que los registros deben realizarse dentro de los perímetros de la institución.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 p-4 text-center border-t">
              <Link href="#" className="text-xs font-bold text-primary flex items-center justify-center gap-1">
                Ver historial completo <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}