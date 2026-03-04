
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Sparkles, Loader2, Calendar, TrendingUp, 
  Users, BarChart3, Printer, 
  MapPin, BookOpen, Clock, FilterX,
  Download, PenTool
} from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, User, Campus, Program, Shift } from '@/lib/types';
import Image from 'next/image';

/**
 * Calcula las horas trabajadas entre dos marcas de tiempo (HH:mm).
 */
function calculateHoursDecimal(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, totalMinutes / 60);
  } catch (e) {
    return 0;
  }
}

/**
 * Formatea una duración decimal en una cadena legible (Xh Ym o Z min).
 */
function formatDuration(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  if (totalMinutes === 0) return '--';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  // Consultas Memorizadas para evitar bucles infinitos y proteger cuota
  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return isDocent 
      ? query(collection(db, 'userProfiles', user.id, 'attendanceRecords'), orderBy('date', 'desc'))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db, user?.id, user?.role, isDocent]);

  const profilesQuery = useMemoFirebase(() => {
    if (!db || isDocent) return null;
    return query(collection(db, 'userProfiles'), orderBy('name'));
  }, [db, isDocent]);

  const shiftsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'shifts'), orderBy('name'));
  }, [db]);

  const campusesQuery = useMemoFirebase(() => {
    if (!db || isDocent) return null;
    return query(collection(db, 'campuses'), orderBy('name'));
  }, [db, isDocent]);

  const programsQuery = useMemoFirebase(() => {
    if (!db || isDocent) return null;
    return query(collection(db, 'programs'), orderBy('name'));
  }, [db, isDocent]);

  const { data: recordsRaw } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: profilesRaw } = useCollection<User>(profilesQuery);
  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: allShiftsRaw } = useCollection<Shift>(shiftsQuery);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const profiles = useMemo(() => profilesRaw || [], [profilesRaw]);
  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const allShifts = useMemo(() => allShiftsRaw || [], [allShiftsRaw]);

  const dailyReports = useMemo(() => {
    const userMap = new Map(profiles.map(p => [p.id, p]));
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const uData = userMap.get(r.userId);
      if (!isDocent) {
        if (selectedDocent !== 'all' && r.userId !== selectedDocent) return;
        if (selectedCampus !== 'all' && uData?.campus !== selectedCampus) return;
        if (selectedProgram !== 'all' && uData?.program !== selectedProgram) return;
        if (selectedShift !== 'all' && r.shiftId !== selectedShift) return;
      }
      const key = `${r.userId}_${r.date}_${r.shiftId || 'none'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: r.userId,
          userName: r.userName,
          date: r.date,
          entry: null,
          exit: null,
          shiftName: r.shiftName || 'N/A',
          program: uData?.program || user?.program || 'N/A',
        });
      }
      const dayData = grouped.get(key);
      if (r.type === 'entry') { if (!dayData.entry || r.time < dayData.entry) dayData.entry = r.time; }
      else { if (!dayData.exit || r.time > dayData.exit) dayData.exit = r.time; }
    });

    const list = Array.from(grouped.values()).map(d => ({ ...d, hours: calculateHoursDecimal(d.entry, d.exit) }));
    const now = new Date();
    return list.filter(r => {
      const recordDate = new Date(r.date + 'T00:00:00');
      if (period === 'Semana Actual') return recordDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (period === 'Mes Actual') return recordDate >= new Date(now.getFullYear(), now.getMonth(), 1);
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, profiles, selectedDocent, selectedCampus, selectedProgram, selectedShift, period, isDocent, user]);

  const chartData = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const counts: Record<string, number> = {};
    days.forEach(d => counts[d] = 0);
    dailyReports.forEach(r => {
      const date = new Date(r.date + 'T00:00:00');
      const dName = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
      if (counts[dName] !== undefined) counts[dName] += r.hours;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, horas: parseFloat(count.toFixed(2)) }));
  }, [dailyReports]);

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
          totalHours: r.hours 
        })),
        reportingPeriod: period
      });
      setAiSummary(result);
    } catch (e) { toast({ variant: "destructive", title: "Error IA" }); } 
    finally { setGeneratingAi(false); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Encabezado Institucional (Visible en Print) */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-2xl text-white font-black text-2xl">DB</div>
           <div>
             <h1 className="text-2xl font-black text-primary uppercase">Ciudad Don Bosco</h1>
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Informe Oficial de Auditoría de Asistencia</p>
           </div>
        </div>
        <div className="text-right space-y-1">
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha de Generación</p>
           <p className="text-sm font-black">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">{isDocent ? 'Mi Historial' : 'Auditoría Institucional'}</h1>
          <p className="text-muted-foreground font-medium italic">Análisis detallado de jornadas y presencia.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-black gap-2" onClick={() => {
            const BOM = "\uFEFF";
            const headers = ["Personal", "Fecha", "Jornada", "Entrada", "Salida", "Horas"];
            const csv = BOM + "sep=;\n" + headers.join(";") + "\n" + dailyReports.map(r => `"${r.userName}";"${r.date}";"${r.shiftName}";"${r.entry || "--"}";"${r.exit || "--"}";"${formatDuration(r.hours)}"`).join("\n");
            const link = document.createElement("a");
            link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
            link.download = "Reporte_DonBosco.csv";
            link.click();
          }}><Download className="w-4 h-4 text-green-600" /> Excel</Button>
          <Button onClick={() => window.print()} className="rounded-xl font-black gap-2 h-11 px-6 shadow-md"><Printer className="w-4 h-4" /> Exportar PDF</Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-[2rem] shadow-xl no-print">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Semana Actual">Semana Actual</SelectItem>
            <SelectItem value="Mes Actual">Mes Actual</SelectItem>
            <SelectItem value="Todo el Historial">Todo</SelectItem>
          </SelectContent>
        </Select>
        
        {!isDocent && (
          <>
            <Select value={selectedDocent} onValueChange={setSelectedDocent}>
              <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Docente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
              <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Sede" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {campuses.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Programa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {programs.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Jornada" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allShifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b bg-gray-50/30"><CardTitle className="text-xl font-black">Visualización de Horas</CardTitle></CardHeader>
          <CardContent className="pt-10 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} unit="h" />
                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900 }} />
                <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden">
          <CardHeader className="p-8"><CardTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="w-6 h-6" /> Auditoría IA</CardTitle></CardHeader>
          <CardContent className="p-8 pt-0 flex flex-col gap-6">
            {aiSummary ? <div className="bg-white/10 p-6 rounded-[2rem] text-sm font-bold animate-in zoom-in overflow-y-auto max-h-[250px]">"{aiSummary.summary}"</div> : (
              <div className="text-center py-10 space-y-6">
                <Button onClick={handleGenerateAiSummary} disabled={generatingAi || dailyReports.length === 0} variant="secondary" className="w-full h-14 rounded-2xl font-black text-primary shadow-xl">
                  {generatingAi ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />} Analizar Periodo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none print:border print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-8 no-print"><CardTitle className="text-xl font-black">Desglose Institucional</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th><th className="px-8 py-6">Fecha</th><th className="px-8 py-6">Jornada</th><th className="px-8 py-6">Entrada/Salida</th><th className="px-8 py-6 text-center">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dailyReports.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-all">
                    <td className="px-8 py-6 font-black text-sm">{r.userName}</td>
                    <td className="px-8 py-6 font-bold text-xs">{r.date}</td>
                    <td className="px-8 py-6"><Badge variant="outline" className="text-[9px] font-black uppercase">{r.shiftName}</Badge></td>
                    <td className="px-8 py-6 text-xs font-bold text-gray-600">{r.entry || '--:--'} → {r.exit || '--:--'}</td>
                    <td className="px-8 py-6 text-center"><Badge className="font-black bg-green-500">{formatDuration(r.hours)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sección de Firma (Visible solo en Print) */}
      <div className="hidden print:flex flex-col items-end mt-20 pr-12">
        <div className="w-64 text-center space-y-4">
          <div className="border-b-2 border-gray-300 pb-2">
            {user?.signatureUrl ? (
              <img src={user.signatureUrl} alt="Firma Responsable" className="h-24 mx-auto object-contain mb-2" />
            ) : (
              <div className="h-24" />
            )}
          </div>
          <div>
            <p className="text-sm font-black uppercase text-gray-800">{user?.name}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">{user?.role || 'Responsable de Auditoría'}</p>
            <p className="text-[8px] font-bold text-gray-400 mt-1">Sello Digital Ciudad Don Bosco</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .sidebar, header, nav, .SidebarTrigger { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .max-w-7xl { max-width: 100% !important; }
          .Card { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #eee !important; padding: 10px !important; }
          .Badge { background-color: transparent !important; color: black !important; border: 1px solid #ccc !important; }
          .bg-green-500 { background-color: #f0fdf4 !important; color: #166534 !important; border: 1px solid #bbf7d0 !important; }
        }
      `}</style>
    </div>
  );
}
