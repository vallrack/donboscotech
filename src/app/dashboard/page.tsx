
"use client"

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, setDoc, serverTimestamp, where, getCountFromServer } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, AlertTriangle, Users, CalendarDays, ArrowRight, BarChart3, Loader2, ShieldAlert, MapPin } from 'lucide-react';
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
  const [todayCount, setTodayCount] = useState<number | null>(null);
  
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Query for the main activity list
  const recordsQuery = useMemoFirebase(() => {
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
        limit(8)
      );
    }
  }, [db, user?.id, user?.role]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);

  // 2. Fetch today's count for Admin/Coordinator stats
  useEffect(() => {
    if (!db || user?.role === 'docent') return;
    
    const fetchTodayStats = async () => {
      const q = query(collection(db, 'globalAttendanceRecords'), where('date', '==', todayStr));
      const snapshot = await getCountFromServer(q);
      setTodayCount(snapshot.data().count);
    };

    fetchTodayStats();
  }, [db, user?.role, todayStr]);

  const stats = useMemo(() => {
    const isAdminView = user?.role !== 'docent';
    
    return [
      { 
        id: 'stat-main',
        label: isAdminView ? 'Presencia Hoy (Sede)' : 'Mis Registros (Mes)', 
        value: isAdminView ? (todayCount !== null ? todayCount.toString() : '...') : (records?.length || 0).toString(), 
        icon: isAdminView ? Users : Clock, 
        color: 'text-primary' 
      },
      { 
        id: 'stat-punctuality',
        label: 'Estado del Sistema', 
        value: 'Activo', 
        icon: CheckCircle2, 
        color: 'text-green-600' 
      },
      { 
        id: 'stat-location',
        label: 'Sede Principal', 
        value: user?.campus || 'Medellín', 
        icon: MapPin, 
        color: 'text-blue-600' 
      },
    ];
  }, [user, todayCount, records]);

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
              : user?.role === 'coordinator' 
              ? 'Gestión académica y control de asistencia.' 
              : `Panel de control para ${user?.role === 'secretary' ? 'Secretaría' : 'Docente'}.`}
          </p>
        </div>
        <div className="flex gap-3">
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

      {user?.role === 'docent' && !user.documentId && (
        <Card className="border-none bg-yellow-500 shadow-2xl shadow-yellow-200/50 text-white rounded-3xl overflow-hidden relative">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Perfil Incompleto
            </CardTitle>
            <CardDescription className="text-yellow-50/80 text-base font-bold">
              Debes completar tu información institucional para generar tu carnet oficial.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard/profile">
              <Button variant="secondary" className="font-bold rounded-xl h-10">
                Completar Mi Perfil
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => (
          <Card key={stat.id} className="border-none shadow-xl shadow-gray-200/50 bg-white rounded-3xl p-2 transition-transform hover:scale-[1.02]">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                {stat.label}
              </CardDescription>
              <CardTitle className="text-4xl font-black">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 pb-6 p-8">
            <CardTitle className="flex items-center gap-3 text-xl font-black">
              <div className="p-2 bg-primary/10 rounded-xl">
                <CalendarDays className="w-5 h-5 text-primary" />
              </div>
              {user?.role === 'docent' ? 'Mis Últimos Registros' : 'Actividad Global Reciente'}
            </CardTitle>
            <CardDescription className="text-sm font-bold opacity-70">
              Sincronizado en tiempo real con la nube institucional.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-6">
            {recordsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Conectando...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-5 rounded-[1.5rem] border border-gray-100 bg-gray-50/30 hover:bg-white hover:shadow-lg transition-all group">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg transition-transform group-hover:scale-110",
                        record.type === 'entry' ? "bg-green-500 shadow-lg shadow-green-200" : "bg-primary shadow-lg shadow-primary/20"
                      )}>
                        {record.type === 'entry' ? 'E' : 'S'}
                      </div>
                      <div>
                        <p className="font-black text-base text-gray-800">{record.userName}</p>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 font-black uppercase tracking-tighter">
                          <Clock className="w-3 h-3" /> {record.date} • {record.time}
                        </div>
                      </div>
                    </div>
                    <Badge variant={record.method === 'QR' ? 'secondary' : 'outline'} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-xl">
                      {record.method}
                    </Badge>
                  </div>
                ))}
                {records.length === 0 && (
                  <div className="text-center py-20 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-100">
                    <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-200" />
                    <p className="text-sm font-black text-gray-400 uppercase">Sin actividad registrada</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 pb-6 p-8">
            <CardTitle className="flex items-center gap-3 text-xl font-black">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Users className="w-5 h-5 text-primary" />
              </div>
              Tablón de Anuncios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              <div className="p-8 hover:bg-gray-50/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-2 mb-2">
                   <Badge className="bg-primary text-[8px] font-black">IMPORTANTE</Badge>
                   <span className="text-[10px] text-muted-foreground font-bold">HOY</span>
                </div>
                <h4 className="font-black text-base group-hover:text-primary transition-colors">Sistema de Carnetización</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                  Recuerda que el carnet digital generado en tu perfil es el único medio autorizado para el registro de asistencia mediante QR en portería.
                </p>
              </div>
              <div className="p-8 hover:bg-gray-50/50 transition-all cursor-pointer group">
                <div className="flex items-center gap-2 mb-2">
                   <Badge variant="outline" className="text-[8px] font-black border-primary text-primary">INFO</Badge>
                   <span className="text-[10px] text-muted-foreground font-bold">AYER</span>
                </div>
                <h4 className="font-black text-base group-hover:text-primary transition-colors">Seguridad de Geolocalización</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                  La validación GPS ahora es más precisa. Asegúrate de tener activado el GPS al momento de escanear en las sedes oficiales.
                </p>
              </div>
            </div>
            <div className="bg-primary/5 p-6 text-center border-t border-primary/10">
              <Link href="#" className="text-sm font-black text-primary flex items-center justify-center gap-2 hover:gap-4 transition-all group">
                Historial de avisos <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
