
"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, Loader2, Calendar, TrendingUp, 
  Users, BarChart3, FileSpreadsheet, Printer, 
  MapPin, BookOpen, Clock, FilterX, AlertCircle
} from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, User, Campus, Program, Shift } from '@/lib/types';

/**
 * Calcula las horas transcurridas entre dos tiempos (HH:mm)
 */
function calculateHours(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, parseFloat((totalMinutes / 60).toFixed(2)));
  } catch (e) {
    return 0;
  }
}

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState('all');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  const recordsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db]);

  const profilesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), orderBy('name'));
  }, [db]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery as any);
  const { data: profiles } = useCollection<User>(profilesQuery as any);
  const { data: campuses } = useCollection<Campus>(db ? collection(db, 'campuses') : null as any);
  const { data: programs } = useCollection<Program>(db ? collection(db, 'programs') : null as any);
  const { data: shifts } = useCollection<Shift>(db ? collection(db, 'shifts') : null as any);

  // Consolidación de registros por usuario y día para cálculo de horas
  const dailyReports = useMemo(() => {
    if (!records || !profiles) return [];
    
    const userMap = new Map(profiles.map(p => [p.id, p]));
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const user = userMap.get(r.userId);
      if (!user) return;

      // Filtros Administrativos
      if (selectedDocent !== 'all' && r.userId !== selectedDocent) return;
      if (selectedCampus !== 'all' && user.campus !== selectedCampus) return;
      if (selectedProgram !== 'all' && user.program !== selectedProgram) return;
      if (selectedShift !== 'all' && !user.shiftIds?.includes(selectedShift)) return;

      const key = `${r.userId}_${r.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: r.userId,
          userName: r.userName,
          date: r.date,
          entry: null,
          exit: null,
          campus: user.campus || 'N/A',
          program: user.program || 'N/A',
          role: user.role
        });
      }

      const dayData = grouped.get(key);
      if (r.type === 'entry') {
        if (!dayData.entry || r.time < dayData.entry) dayData.entry = r.time;
      } else {
        if (!dayData.exit || r.time > dayData.exit) dayData.exit = r.time;
      }
    });

    const list = Array.from(grouped.values()).map(d => ({
      ...d,
      hours: calculateHours(d.entry, d.exit)
    }));

    // Filtro de Periodo Real
    const now = new Date();
    return list.filter(r => {
      const recordDate = new Date(r.date + 'T00:00:00');
      if (period === 'Semana Actual') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return recordDate >= weekAgo;
      } else if (period === 'Mes Actual') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return recordDate >= monthStart;
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, profiles, selectedDocent, selectedCampus, selectedProgram, selectedShift, period]);

  const chartData = useMemo(() => {
    if (!dailyReports.length) {
      const emptyDays = viewType === 'monthly' ? ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'] : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
      return emptyDays.map(name => ({ name: name, horas: 0 }));
    }

    if (viewType === 'weekly') {
      const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const counts: Record<string, number> = {};
      days.forEach(d => counts[d] = 0);

      dailyReports.forEach(r => {
        const date = new Date(r.date + 'T00:00:00');
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const dayName = days[dayIndex];
        if (counts[dayName] !== undefined) counts[dayName] += r.hours;
      });

      return Object.entries(counts).map(([name, count]) => ({ name: name, horas: parseFloat(count.toFixed(1)) }));
    } else {
      const weeks: Record<string, number> = { 'Sem 1': 0, 'Sem 2': 0, 'Sem 3': 0, 'Sem 4': 0, 'Sem 5': 0 };
      dailyReports.forEach(r => {
        const date = new Date(r.date + 'T00:00:00');
        const dayOfMonth = date.getDate();
        const weekNum = Math.ceil(dayOfMonth / 7);
        const weekLabel = `Sem ${weekNum > 5 ? 5 : weekNum}`;
        weeks[weekLabel] += r.hours;
      });
      return Object.entries(weeks).map(([name, count]) => ({ name: name, horas: parseFloat(count.toFixed(1)) }));
    }
  }, [viewType, dailyReports]);

  const handleGenerateAiSummary = async () => {
    if (dailyReports.length === 0) {
      toast({ title: "Sin datos reales", description: "La base de datos está vacía. Registre asistencias para analizar.", variant: "destructive" });
      return;
    }
    
    setGeneratingAi(true);
    try {
      const reportData = dailyReports.slice(0, 50).map(r => ({
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        entryTime: r.entry,
        exitTime: r.exit,
        totalHours: r.hours,
        isLate: r.entry && r.entry > '07:15',
        isAbsent: !r.entry && !r.exit,
      }));

      const context = [
        period,
        selectedDocent !== 'all' ? `Personal Seleccionado` : 'Auditoría General',
        selectedCampus !== 'all' ? `Sede: ${selectedCampus}` : '',
        selectedProgram !== 'all' ? `Programa: ${selectedProgram}` : ''
      ].filter(Boolean).join(' | ');

      const result = await summarizeAttendanceReport({
        reportData,
        reportingPeriod: context
      });
      setAiSummary(result);
    } catch (err) {
      toast({ title: "Error en IA", description: "No se pudo conectar con el motor de auditoría.", variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col gap-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
            <p className="text-muted-foreground font-medium">Análisis de horas reales laboradas en Ciudad Don Bosco.</p>
          </div>
          <Button variant="ghost" className="text-muted-foreground font-black text-[10px] uppercase tracking-widest gap-2" onClick={() => { setPeriod('Mes Actual'); setSelectedDocent('all'); setSelectedCampus('all'); setSelectedProgram('all'); setSelectedShift('all'); setAiSummary(null); }}>
            <FilterX className="w-4 h-4" /> Resetear Filtros
          </Button>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-[2rem] shadow-xl border border-gray-100">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Temporalidad</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Calendar className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Semana Actual">Semana Actual</SelectItem><SelectItem value="Mes Actual">Mes Actual</SelectItem><SelectItem value="Todo el Historial">Todo el Historial</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Personal</label>
            <Select value={selectedDocent} onValueChange={setSelectedDocent}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Users className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el Personal</SelectItem>
                {profiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sede</label>
            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><MapPin className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Sedes</SelectItem>
                {campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Programa</label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><BookOpen className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Programas</SelectItem>
                {programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Jornada</label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Clock className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las Jornadas</SelectItem>
                {shifts?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="pb-2 border-b bg-gray-50/30 p-8">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-xl font-black text-gray-800">Carga Horaria Laborada</CardTitle><CardDescription className="font-bold">Horas acumuladas según registros de entrada/salida.</CardDescription></div>
              <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="no-print">
                <TabsList className="bg-gray-100 rounded-xl h-10 p-1"><TabsTrigger value="weekly" className="text-[10px] font-black uppercase px-4">Semanal</TabsTrigger><TabsTrigger value="monthly" className="text-[10px] font-black uppercase px-4">Mensual</TabsTrigger></TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-10 h-[400px]">
            {recordsLoading ? (
               <div className="flex items-center justify-center h-full"><Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" /></div>
            ) : dailyReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="p-4 bg-gray-50 rounded-full border-2 border-dashed"><BarChart3 className="w-10 h-10 text-gray-200" /></div>
                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No hay jornadas reales para graficar</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} unit="h" />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900 }} />
                  <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden flex flex-col">
          <CardHeader className="p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="w-6 h-6" /> Auditoría IA</CardTitle>
            <CardDescription className="text-primary-foreground/70 font-bold uppercase tracking-widest text-[10px]">Análisis automatizado de cumplimiento</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-8 pt-0 flex flex-col gap-6">
            {aiSummary ? (
              <div className="bg-white/10 p-6 rounded-[2rem] border border-white/10 text-sm italic font-bold animate-in zoom-in">"{aiSummary.summary}"</div>
            ) : (
              <div className="text-center py-10 space-y-6">
                <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto"><Clock className="w-10 h-10 opacity-30" /></div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-widest px-4">
                  {dailyReports.length > 0 ? `Listo para auditar ${dailyReports.length} jornadas reales.` : "Esperando registros para auditoría."}
                </p>
                <Button onClick={handleGenerateAiSummary} disabled={generatingAi || dailyReports.length === 0} variant="secondary" className="w-full h-14 rounded-2xl font-black text-primary shadow-xl">
                  {generatingAi ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />} Analizar Jornadas
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="border-b bg-gray-50/50 p-8">
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-xl font-black">Historial de Jornadas Consolidado</CardTitle><CardDescription className="font-bold">Resultados basados en la base de datos real.</CardDescription></div>
            <Badge className="bg-primary/10 text-primary font-black px-4 py-1.5 rounded-xl">{dailyReports.length} JORNADAS</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th><th className="px-8 py-6">Programa / Sede</th><th className="px-8 py-6">Fecha</th><th className="px-8 py-6">Entrada / Salida</th><th className="px-8 py-6 text-center">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/20" /></td></tr>
                ) : dailyReports.length === 0 ? (
                  <tr><td colSpan={5} className="py-40 text-center font-black text-gray-200 uppercase tracking-widest italic">Base de datos institucional limpia - Sin registros</td></tr>
                ) : (
                  dailyReports.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-all">
                      <td className="px-8 py-6 font-black text-gray-800">{r.userName}</td>
                      <td className="px-8 py-6"><span className="text-[9px] font-black uppercase text-primary bg-primary/5 px-2 py-1 rounded-lg">{r.program}</span></td>
                      <td className="px-8 py-6 font-bold text-xs">{r.date}</td>
                      <td className="px-8 py-6 text-xs font-bold text-gray-600">{r.entry || '--'} → {r.exit || '--'}</td>
                      <td className="px-8 py-6 text-center"><Badge className={cn("font-black", r.hours > 0 ? "bg-green-500" : "bg-red-100 text-red-500")}>{r.hours}h</Badge></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
