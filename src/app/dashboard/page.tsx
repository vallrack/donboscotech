
"use client"

import { useMemo, useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, getCountFromServer, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, Users, CalendarDays, Loader2, MapPin, Megaphone, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceRecord, Announcement, Shift } from '@/lib/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { sendAttendanceReminder } from '@/ai/flows/attendance-reminder-flow';

export default function DashboardPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const [needsCheckIn, setNeedsCheckIn] = useState<Shift | null>(null);
  const hasSentAutoReminder = useRef(false);
  
  // Usar fecha local YYYY-MM-DD
  const todayStr = useMemo(() => new Date().toLocaleDateString('sv-SE'), []);

  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return user.role === 'docent'
      ? query(collection(db, 'userProfiles', user.id, 'attendanceRecords'), orderBy('date', 'desc'), limit(5))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'), limit(8));
  }, [db, user?.id, user?.role]);

  const announcementsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(20));
  }, [db]);

  const { data: recordsRaw, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: annRaw, loading: annLoading } = useCollection<Announcement>(announcementsQuery as any);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const activeAnnouncements = useMemo(() => {
    return (annRaw || []).filter(a => a.status === 'active');
  }, [annRaw]);

  useEffect(() => {
    if (!db || !user || user.role !== 'docent') return;

    const checkMissingAttendance = async () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const [currH, currM] = timeStr.split(':').map(Number);
      const currTotal = currH * 60 + currM;
      const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

      try {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        const allShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
        const todayShifts = allShifts.filter(s => user.shiftIds?.includes(s.id) && s.days?.includes(dayName));

        for (const s of todayShifts) {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const startT = sh * 60 + sm;
          
          if (currTotal >= (startT - 10) && currTotal <= (startT + 120)) {
            const q = query(
              collection(db, 'userProfiles', user.id, 'attendanceRecords'), 
              where('date', '==', todayStr),
              where('type', '==', 'entry')
            );
            const snap = await getDocs(q);
            if (snap.empty) {
              setNeedsCheckIn(s);
              
              if (!hasSentAutoReminder.current) {
                hasSentAutoReminder.current = true;
                sendAttendanceReminder({
                  userName: user.name,
                  userEmail: user.email,
                  shiftName: s.name,
                  startTime: s.startTime
                }).catch(e => console.error("Error envío automático:", e));
              }
            } else {
              setNeedsCheckIn(null);
            }
            break;
          }
        }
      } catch (e) { console.error(e); }
    };

    checkMissingAttendance();
  }, [db, user, todayStr]);

  useEffect(() => {
    if (!db || !user || user.role === 'docent') return;
    const fetchTodayStats = async () => {
      try {
        const q = query(
          collection(db, 'globalAttendanceRecords'), 
          where('date', '==', todayStr),
          where('type', '==', 'entry')
        );
        const snapshot = await getCountFromServer(q);
        setTodayCount(snapshot.data().count);
      } catch (e) { 
        console.error("Error fetching stats:", e);
        setTodayCount(0); 
      }
    };
    fetchTodayStats();
  }, [db, user?.role, todayStr, user?.id]);

  const stats = useMemo(() => {
    const isAdminView = user?.role !== 'docent';
    return [
      { 
        id: 'stat-main', 
        label: isAdminView ? 'Presencia Hoy' : 'Mis Registros', 
        value: isAdminView 
          ? (todayCount !== null ? todayCount.toString() : '...') 
          : (records?.length || 0).toString(), 
        icon: isAdminView ? Users : Clock, 
        color: 'text-primary' 
      },
      { id: 'stat-status', label: 'Estado', value: 'Sincronizado', icon: CheckCircle2, color: 'text-green-600' },
      { id: 'stat-loc', label: 'Sede Principal', value: user?.campus || 'Don Bosco Medellín', icon: MapPin, color: 'text-blue-600' },
    ];
  }, [user, todayCount, records]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Hola, {user?.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium italic">Panel institucional - Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild size="lg" className="h-14 px-8 shadow-xl font-bold rounded-2xl">
            <Link href="/dashboard/attendance/scan"><Clock className="w-5 h-5 mr-2" /> Marcar Asistencia</Link>
          </Button>
        </div>
      </div>

      {needsCheckIn && (
        <Alert variant="destructive" className="bg-red-50 border-2 border-red-200 rounded-[2rem] p-8 shadow-xl animate-bounce">
          <AlertTriangle className="h-8 w-8 text-red-600" />
          <div className="ml-4">
            <AlertTitle className="text-xl font-black text-red-600">¡Atención, Colaborador!</AlertTitle>
            <AlertDescription className="text-gray-700 font-bold mt-2">
              No has registrado tu entrada para la jornada <span className="text-primary">{needsCheckIn.name}</span> ({needsCheckIn.startTime}). 
              Es obligatorio realizar el registro GPS ahora mismo. Un recordatorio ha sido enviado a tu correo.
            </AlertDescription>
            <Button asChild className="mt-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl">
              <Link href="/dashboard/attendance/scan" className="flex items-center gap-2">
                Ir a Marcar Ahora <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => (
          <Card key={stat.id} className="border-none shadow-xl bg-white rounded-3xl p-2 transition-transform hover:scale-105">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest text-muted-foreground">
                <stat.icon className={`w-4 h-4 ${stat.color}`} /> {stat.label}
              </CardDescription>
              <CardTitle className="text-4xl font-black">{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 p-8">
            <CardTitle className="flex items-center gap-3 text-xl font-black"><CalendarDays className="w-5 h-5 text-primary" /> {user?.role === 'docent' ? 'Mis Últimos Registros' : 'Actividad Reciente'}</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {recordsLoading ? <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></div> : (
              <div className="space-y-4">
                {records.length > 0 ? records.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-gray-50/30 border border-gray-100 transition-colors hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm", r.type === 'entry' ? "bg-green-500" : "bg-primary")}>{r.type === 'entry' ? 'E' : 'S'}</div>
                      <div><p className="font-black text-sm">{r.userName}</p><p className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{r.date} • {r.time}</p></div>
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-black px-3 py-1">{r.method}</Badge>
                  </div>
                )) : (
                  <p className="text-center py-10 text-muted-foreground font-medium italic">No hay registros hoy.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 p-8">
            <CardTitle className="flex items-center gap-3 text-xl font-black"><Megaphone className="w-5 h-5 text-primary" /> Muro de Anuncios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {annLoading ? (
              <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto opacity-10" /></div>
            ) : (
              <ScrollArea className="h-[450px]">
                <div className="divide-y divide-gray-50">
                  {activeAnnouncements.length > 0 ? activeAnnouncements.map((ann) => (
                    <div key={ann.id} className="p-8 hover:bg-gray-50/50 transition-all group">
                      <Badge className={cn("text-[8px] font-black mb-2 px-3 py-1", ann.priority === 'high' ? "bg-red-500" : "bg-primary")}>{ann.priority === 'high' ? 'IMPORTANTE' : 'ANUNCIO'}</Badge>
                      <h4 className="font-black text-base group-hover:text-primary transition-colors">{ann.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{ann.content}</p>
                      <div className="mt-4 text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Publicado por {ann.authorName}</div>
                    </div>
                  )) : (
                    <div className="py-20 text-center text-muted-foreground font-black uppercase tracking-widest opacity-20 italic">No hay comunicados activos.</div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
