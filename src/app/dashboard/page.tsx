
"use client"

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, getCountFromServer } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle2, Users, CalendarDays, Loader2, MapPin, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceRecord, Announcement } from '@/lib/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const [todayCount, setTodayCount] = useState<number | null>(null);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Consultas memoizadas con useMemoFirebase para evitar Quota Exceeded
  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    if (user.role === 'docent') {
      return query(
        collection(db, 'userProfiles', user.id, 'attendanceRecords'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
    } else {
      return query(
        collection(db, 'globalAttendanceRecords'),
        orderBy('createdAt', 'desc'),
        limit(8)
      );
    }
  }, [db, user?.id, user?.role]);

  const announcementsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(
      collection(db, 'announcements'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [db]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: activeAnnouncements, loading: annLoading } = useCollection<Announcement>(announcementsQuery as any);

  useEffect(() => {
    if (!db || user?.role === 'docent') return;
    const fetchTodayStats = async () => {
      try {
        const q = query(collection(db, 'globalAttendanceRecords'), where('date', '==', todayStr));
        const snapshot = await getCountFromServer(q);
        setTodayCount(snapshot.data().count);
      } catch (e) {
        setTodayCount(0);
      }
    };
    fetchTodayStats();
  }, [db, user?.role, todayStr]);

  const stats = useMemo(() => {
    const isAdminView = user?.role !== 'docent';
    return [
      { id: 'stat-main', label: isAdminView ? 'Presencia Hoy' : 'Mis Registros', value: isAdminView ? (todayCount !== null ? todayCount.toString() : '...') : (records?.length || 0).toString(), icon: isAdminView ? Users : Clock, color: 'text-primary' },
      { id: 'stat-punctuality', label: 'Estado', value: 'Sincronizado', icon: CheckCircle2, color: 'text-green-600' },
      { id: 'stat-location', label: 'Sede Principal', value: user?.campus || 'Medellín', icon: MapPin, color: 'text-blue-600' },
    ];
  }, [user, todayCount, records]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-primary">Hola, {user?.name.split(' ')[0]}</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Panel institucional - Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-3">
          <Button asChild size="lg" className="h-14 px-8 shadow-xl font-bold rounded-2xl">
            <Link href="/dashboard/attendance/scan"><Clock className="w-5 h-5 mr-2" /> Marcar Asistencia</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {stats.map((stat) => (
          <Card key={stat.id} className="border-none shadow-xl bg-white rounded-3xl p-2">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 font-black text-[10px] uppercase tracking-widest">
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
            <CardTitle className="flex items-center gap-3 text-xl font-black">
              <div className="p-2 bg-primary/10 rounded-xl"><CalendarDays className="w-5 h-5 text-primary" /></div>
              {user?.role === 'docent' ? 'Mis Últimos Registros' : 'Actividad Reciente'}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 pt-6">
            {recordsLoading ? <Loader2 className="w-10 h-10 animate-spin mx-auto opacity-20" /> : (
              <div className="space-y-4">
                {records.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-5 rounded-[1.5rem] border border-gray-100 bg-gray-50/30 hover:bg-white hover:shadow-lg transition-all">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs", record.type === 'entry' ? "bg-green-500" : "bg-primary")}>
                        {record.type === 'entry' ? 'E' : 'S'}
                      </div>
                      <div>
                        <p className="font-black text-sm">{record.userName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">{record.date} • {record.time}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black uppercase">{record.method} • {record.shiftName || 'S/J'}</Badge>
                  </div>
                ))}
                {records.length === 0 && <p className="text-center py-10 text-muted-foreground text-xs font-black uppercase tracking-widest">Sin registros recientes</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-2xl border-none bg-white rounded-[2.5rem] overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50 p-8">
            <CardTitle className="flex items-center gap-3 text-xl font-black">
              <div className="p-2 bg-primary/10 rounded-xl"><Megaphone className="w-5 h-5 text-primary" /></div>
              Muro de Anuncios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {annLoading ? (
              <div className="p-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-10" /></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {activeAnnouncements.map((ann) => (
                  <div key={ann.id} className="p-8 hover:bg-gray-50/50 transition-all group">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={cn("text-[8px] font-black", ann.priority === 'high' ? "bg-red-500" : "bg-primary")}>
                        {ann.priority === 'high' ? 'IMPORTANTE' : 'ANUNCIO'}
                      </Badge>
                      <span className="text-[10px] font-black text-muted-foreground opacity-40 uppercase tracking-tighter">
                        Por {ann.authorName}
                      </span>
                    </div>
                    <h4 className="font-black text-base group-hover:text-primary transition-colors">{ann.title}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">{ann.content}</p>
                  </div>
                ))}
                {activeAnnouncements.length === 0 && (
                  <div className="p-20 text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-30">
                    No hay anuncios activos.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
