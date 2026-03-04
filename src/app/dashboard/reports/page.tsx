
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, Loader2, Calendar, TrendingUp, 
  Users, BarChart3, Printer, 
  MapPin, BookOpen, Clock, FilterX,
  Download
} from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, User, Campus, Program, Shift } from '@/lib/types';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const db = useFirestore();
  
  const isDocent = user?.role === 'docent';
  
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState(isDocent ? user?.id : 'all');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('weekly');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    if (isDocent) {
      return query(
        collection(db, 'userProfiles', user.id, 'attendanceRecords'), 
        orderBy('date', 'desc')
      );
    } else {
      return query(
        collection(db, 'globalAttendanceRecords'), 
        orderBy('date', 'desc')
      );
    }
  }, [db, user?.id, user?.role, isDocent]);

  const profilesQuery = useMemo(() => {
    if (!db || isDocent) return null;
    return query(collection(db, 'userProfiles'), orderBy('name'));
  }, [db, isDocent]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery as any);
  const { data: profiles } = useCollection<User>(profilesQuery as any);
  const { data: campuses } = useCollection<Campus>(db && !isDocent ? collection(db, 'campuses') : null as any);
  const { data: programs } = useCollection<Program>(db && !isDocent ? collection(db, 'programs') : null as any);
  const { data: shifts } = useCollection<Shift>(db && !isDocent ? collection(db, 'shifts') : null as any);

  const dailyReports = useMemo(() => {
    if (!records) return [];
    
    const userMap = profiles ? new Map(profiles.map(p => [p.id, p])) : null;
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const uData = userMap ? userMap.get(r.userId) : null;
      
      if (!isDocent) {
        if (selectedDocent !== 'all' && r.userId !== selectedDocent) return;
        if (selectedCampus !== 'all' && uData?.campus !== selectedCampus) return;
        if (selectedProgram !== 'all' && uData?.program !== selectedProgram) return;
        if (selectedShift !== 'all' && !uData?.shiftIds?.includes(selectedShift)) return;
      }

      const key = `${r.userId}_${r.date}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: r.userId,
          userName: r.userName,
          date: r.date,
          entry: null,
          exit: null,
          campus: uData?.campus || user?.campus || 'N/A',
          program: uData?.program || user?.program || 'N/A',
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
  }, [records, profiles, selectedDocent, selectedCampus, selectedProgram, selectedShift, period, isDocent, user]);

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
        const weekNum = Math.ceil(date.getDate() / 7);
        const weekLabel = `Sem ${weekNum > 5 ? 5 : weekNum}`;
        weeks[weekLabel] += r.hours;
      });
      return Object.entries(weeks).map(([name, count]) => ({ name: name, horas: parseFloat(count.toFixed(1)) }));
    }
  }, [viewType, dailyReports]);

  const handleGenerateAiSummary = async () => {
    if (dailyReports.length === 0) return;
    setGeneratingAi(true);
    try {
      const result = await summarizeAttendanceReport({
        reportData: dailyReports.map(r => ({
          userId: r.userId,
          userName: r.userName,
          date: r.date,
          entryTime: r.entry || undefined,
          exitTime: r.exit || undefined,
          totalHours: r.hours,
        })),
        reportingPeriod: period
      });
      setAiSummary(result);
    } catch (error) {
      toast({ variant: "destructive", title: "Error de IA", description: "No se pudo generar el resumen inteligente." });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportExcel = () => {
    if (dailyReports.length === 0) {
      toast({ title: "Sin datos", description: "No hay registros para exportar.", variant: "destructive" });
      return;
    }

    const BOM = "\uFEFF";
    const excelSeparator = "sep=;\n";
    const headers = ["Docente", "Fecha", "Entrada", "Salida", "Horas Totales", "Sede", "Programa"];
    
    const csvRows = dailyReports.map(r => [
      `"${r.userName}"`,
      `"${r.date}"`,
      `"${r.entry || "--"}"`,
      `"${r.exit || "--"}"`,
      `"${r.hours}"`,
      `"${r.campus}"`,
      `"${r.program}"`
    ].join(";"));

    const csvContent = BOM + excelSeparator + headers.join(";") + "\n" + csvRows.join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_DonBosco_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Excel Generado", description: "El reporte se ha descargado con formato profesional para Excel." });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col gap-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tighter">
              {isDocent ? 'Mi Historial de Asistencia' : 'Auditoría Institucional'}
            </h1>
            <p className="text-muted-foreground font-medium">
              {isDocent ? 'Consulta tus horas laboradas y registros oficiales.' : 'Análisis de horas reales en Ciudad Don Bosco.'}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="rounded-xl font-black h-10 gap-2 shadow-sm" onClick={handleExportExcel}>
              <Download className="w-4 h-4 text-green-600" /> Excel
            </Button>
            <Button variant="default" className="rounded-xl font-black h-10 gap-2 shadow-sm" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> PDF / Imprimir
            </Button>
            {!isDocent && (
              <Button variant="ghost" className="text-muted-foreground font-black text-[10px] uppercase tracking-widest gap-2" onClick={() => { setPeriod('Mes Actual'); setSelectedDocent('all'); setSelectedCampus('all'); setSelectedProgram('all'); setSelectedShift('all'); setAiSummary(null); }}>
                <FilterX className="w-4 h-4" /> Limpiar
              </Button>
            )}
          </div>
        </div>
        
        <div className={cn(
          "grid grid-cols-1 gap-3 bg-white p-4 rounded-[2rem] shadow-xl border border-gray-100",
          isDocent ? "sm:grid-cols-1 max-w-xs" : "sm:grid-cols-2 lg:grid-cols-5"
        )}>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Periodo</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Calendar className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="Semana Actual">Semana Actual</SelectItem><SelectItem value="Mes Actual">Mes Actual</SelectItem><SelectItem value="Todo el Historial">Todo el Historial</SelectItem></SelectContent>
            </Select>
          </div>
          
          {!isDocent && (
            <>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Docente</label>
                <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                  <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Users className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{profiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sede</label>
                <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                  <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><MapPin className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem>{campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Programa</label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><BookOpen className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todos</SelectItem>{programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Jornada</label>
                <Select value={selectedShift} onValueChange={setSelectedShift}>
                  <SelectTrigger className="h-10 rounded-xl font-bold bg-gray-50 border-none"><Clock className="w-3.5 h-3.5 mr-2 text-primary"/><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem>{shifts?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none">
          <CardHeader className="pb-2 border-b bg-gray-50/30 p-8">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-xl font-black text-gray-800">Visualización de Horas</CardTitle><CardDescription className="font-bold">Resumen gráfico de tiempo laborado.</CardDescription></div>
              <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="no-print">
                <TabsList className="bg-gray-100 rounded-xl h-10 p-1"><TabsTrigger value="weekly" className="text-[10px] font-black uppercase px-4">Semanal</TabsTrigger><TabsTrigger value="monthly" className="text-[10px] font-black uppercase px-4">Mensual</TabsTrigger></TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-10 h-[350px]">
            {recordsLoading ? (
               <div className="flex items-center justify-center h-full"><Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" /></div>
            ) : dailyReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <BarChart3 className="w-10 h-10 text-gray-200 mb-4" />
                <p className="text-xs font-black text-gray-300 uppercase">Sin datos registrados</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} unit="h" />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900 }} />
                  <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={isDocent ? 60 : 40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden flex flex-col no-print">
          <CardHeader className="p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="w-6 h-6" /> Auditoría IA</CardTitle>
            <CardDescription className="text-primary-foreground/70 font-bold uppercase tracking-widest text-[10px]">Asistente Inteligente Don Bosco</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-8 pt-0 flex flex-col gap-6">
            {aiSummary ? (
              <div className="bg-white/10 p-6 rounded-[2rem] border border-white/10 text-sm font-bold animate-in zoom-in overflow-y-auto max-h-[250px]">"{aiSummary.summary}"</div>
            ) : (
              <div className="text-center py-10 space-y-6">
                <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto"><TrendingUp className="w-10 h-10 opacity-30" /></div>
                <Button onClick={handleGenerateAiSummary} disabled={generatingAi || dailyReports.length === 0} variant="secondary" className="w-full h-14 rounded-2xl font-black text-primary shadow-xl">
                  {generatingAi ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />} Analizar Actividad
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none print:border">
        <CardHeader className="border-b bg-gray-50/50 p-8">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-black">Desglose Detallado</CardTitle>
            <Badge className="bg-primary/10 text-primary font-black px-4 py-1.5 rounded-xl">{dailyReports.length} DÍAS REGISTRADOS</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th><th className="px-8 py-6">Fecha</th><th className="px-8 py-6">Entrada → Salida</th><th className="px-8 py-6 text-center">Horas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={4} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/20" /></td></tr>
                ) : dailyReports.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-all">
                    <td className="px-8 py-6">
                      <p className="font-black text-gray-800 text-sm">{r.userName}</p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase">{r.program}</p>
                    </td>
                    <td className="px-8 py-6 font-bold text-xs">{r.date}</td>
                    <td className="px-8 py-6 text-xs font-bold text-gray-600">{r.entry || '--:--'} → {r.exit || '--:--'}</td>
                    <td className="px-8 py-6 text-center"><Badge className={cn("font-black", r.hours > 0 ? "bg-green-500" : "bg-red-100 text-red-500")}>{r.hours}h</Badge></td>
                  </tr>
                ))}
                {!recordsLoading && dailyReports.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-muted-foreground font-black uppercase tracking-widest opacity-20 italic">
                      No se encontraron registros bajo este criterio.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #eee !important; }
          .sidebar, header, nav, footer { display: none !important; }
          main { padding: 0 !important; }
          .max-w-7xl { max-width: 100% !important; }
          .Card { border: 1px solid #ddd !important; }
        }
      `}</style>
    </div>
  );
}
