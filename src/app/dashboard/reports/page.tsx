
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
  Download, PenTool, ShieldCheck
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

function calculateHoursDecimal(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, totalMinutes / 60);
  } catch (e) { return 0; }
}

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
  const [selectedDocent, setSelectedDocent] = useState('all');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  // Queries estabilizadas con useMemoFirebase para prevenir bucles infinitos
  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return (isDocent || (selectedDocent !== 'all' && !isDocent))
      ? query(collection(db, 'userProfiles', isDocent ? user.id : selectedDocent, 'attendanceRecords'), orderBy('date', 'desc'))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db, user?.id, isDocent, selectedDocent]);

  const profilesQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);

  const shiftsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const campusesQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);

  const programsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);

  const { data: recordsRaw, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: profilesRaw } = useCollection<User>(profilesQuery);
  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: allShiftsRaw } = useCollection<Shift>(shiftsQuery);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const profiles = useMemo(() => profilesRaw || [], [profilesRaw]);
  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const allShifts = useMemo(() => allShiftsRaw || [], [allShiftsRaw]);

  // Lógica de filtrado y agrupación dinámica
  const dailyReports = useMemo(() => {
    const userMap = new Map(profiles.map(p => [p.id, p]));
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const uData = userMap.get(r.userId);
      
      // Filtros administrativos
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
          program: uData?.program || 'N/A',
          campus: uData?.campus || 'N/A',
          documentId: uData?.documentId || 'N/A'
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
      hours: calculateHoursDecimal(d.entry, d.exit) 
    }));

    const now = new Date();
    return list.filter(r => {
      const recordDate = new Date(r.date + 'T00:00:00');
      if (period === 'Semana Actual') {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        return recordDate >= lastWeek;
      }
      if (period === 'Mes Actual') {
        return recordDate >= new Date(now.getFullYear(), now.getMonth(), 1);
      }
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [records, profiles, selectedDocent, selectedCampus, selectedProgram, selectedShift, period, isDocent]);

  const chartData = useMemo(() => {
    const days = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
    const counts: Record<string, number> = {};
    days.forEach(d => counts[d] = 0);
    dailyReports.forEach(r => {
      const date = new Date(r.date + 'T00:00:00');
      const dName = days[date.getDay() === 0 ? 6 : date.getDay() - 1];
      if (counts[dName] !== undefined) counts[dName] += r.hours;
    });
    return Object.entries(counts).map(([name, count]) => ({ 
      name, 
      horas: parseFloat(count.toFixed(2)) 
    }));
  }, [dailyReports]);

  const handleExportExcel = () => {
    const BOM = "\uFEFF";
    const sep = ";";
    const headers = ["Personal", "Cédula", "Sede", "Programa", "Fecha", "Jornada", "Entrada", "Salida", "Duración", "Validación Digital"];
    
    const metaData = [
      ["CIUDAD DON BOSCO - REPORTE OFICIAL DE ASISTENCIA"],
      [`Periodo: ${period}`],
      [`Filtro Sede: ${selectedCampus === 'all' ? 'Todas' : selectedCampus}`],
      [`Generado por: ${user?.name} (${user?.role})`],
      [`Fecha de generación: ${new Date().toLocaleString()}`],
      [],
      headers
    ];

    const rows = dailyReports.map(r => [
      r.userName,
      r.documentId,
      r.campus,
      r.program,
      r.date,
      r.shiftName,
      r.entry || "--:--",
      r.exit || "--:--",
      formatDuration(r.hours),
      "Firma Sincronizada"
    ]);

    const csvContent = metaData.concat(rows).map(row => row.map(cell => `"${cell}"`).join(sep)).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_DonBosco_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleGenerateAiSummary = async () => {
    if (dailyReports.length === 0) return;
    setGeneratingAi(true);
    try {
      const result = await summarizeAttendanceReport({
        reportData: dailyReports.map(r => ({ 
          userId: r.userId, userName: r.userName, date: r.date, entryTime: r.entry || undefined, 
          exitTime: r.exit || undefined, totalHours: r.hours 
        })),
        reportingPeriod: period
      });
      setAiSummary(result);
    } catch (e) { 
      toast({ variant: "destructive", title: "Error en el análisis de IA" }); 
    } finally { 
      setGeneratingAi(false); 
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Institucional para Impresión */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-4">
           <div className="w-16 h-16 bg-primary flex items-center justify-center rounded-2xl text-white font-black text-2xl">DB</div>
           <div>
             <h1 className="text-2xl font-black text-primary uppercase">Ciudad Don Bosco</h1>
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Informe Oficial de Auditoría de Asistencia</p>
           </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fecha de Reporte</p>
          <p className="text-sm font-black">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
          <p className="text-muted-foreground font-medium italic">Sincronización en tiempo real de presencia y jornadas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-black gap-2 h-11" onClick={handleExportExcel}>
            <Download className="w-4 h-4 text-green-600" /> Exportar Excel
          </Button>
          <Button onClick={() => window.print()} className="rounded-xl font-black gap-2 h-11 px-6 shadow-md">
            <Printer className="w-4 h-4" /> Imprimir PDF
          </Button>
        </div>
      </div>
      
      {/* Panel de Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-[2rem] shadow-xl no-print">
        <div className="space-y-1">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Periodo</p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Semana Actual">Semana Actual</SelectItem>
              <SelectItem value="Mes Actual">Mes Actual</SelectItem>
              <SelectItem value="Todo el Historial">Todo el Historial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isDocent && (
          <>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Personal</p>
              <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Docente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Miembros</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sede</p>
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Sede" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Sedes</SelectItem>
                  {campuses.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Programa</p>
              <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Programa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Programas</SelectItem>
                  {programs.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Jornada</p>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none"><SelectValue placeholder="Jornada" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Jornadas</SelectItem>
                  {allShifts.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Visualización Gráfica y IA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 no-print">
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="p-8 border-b bg-gray-50/30">
            <CardTitle className="text-xl font-black">Tendencia de Presencia (Horas)</CardTitle>
          </CardHeader>
          <CardContent className="pt-10 h-[350px]">
            {recordsLoading ? (
              <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin opacity-20" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900 }} unit="h" />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: 900 }} />
                  <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden flex flex-col">
          <CardHeader className="p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3"><Sparkles className="w-6 h-6" /> Resumen IA</CardTitle>
            <CardDescription className="text-white/70 font-bold">Análisis inteligente del periodo seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 flex-1">
            {aiSummary ? (
              <div className="bg-white/10 p-6 rounded-[2rem] text-sm font-bold animate-in zoom-in h-full max-h-[250px] overflow-y-auto">
                "{aiSummary.summary}"
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-6 py-10">
                <div className="p-4 rounded-full bg-white/10"><TrendingUp className="w-10 h-10" /></div>
                <Button onClick={handleGenerateAiSummary} disabled={generatingAi || dailyReports.length === 0} variant="secondary" className="w-full h-14 rounded-2xl font-black text-primary shadow-xl">
                  {generatingAi ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} 
                  Generar Auditoría IA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Desglose Institucional */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none print:border print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-8">
          <CardTitle className="text-xl font-black">Desglose Institucional</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th>
                  <th className="px-8 py-6">Fecha</th>
                  <th className="px-8 py-6">Jornada</th>
                  <th className="px-8 py-6">Entrada/Salida</th>
                  <th className="px-8 py-6 text-center">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  dailyReports.map((r, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-all">
                      <td className="px-8 py-6">
                        <div className="font-black text-sm">{r.userName}</div>
                        <div className="text-[10px] text-muted-foreground font-bold">{r.campus} • {r.program}</div>
                      </td>
                      <td className="px-8 py-6 font-bold text-xs">{r.date}</td>
                      <td className="px-8 py-6">
                        <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter">
                          {r.shiftName}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-gray-600">
                        {r.entry || '--:--'} → {r.exit || '--:--'}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <Badge className="font-black bg-green-500 text-white rounded-lg px-3 py-1">
                          {formatDuration(r.hours)}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground font-bold italic">No se encontraron registros para este criterio.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sello de Firma al final del Reporte */}
      <div className="hidden print:flex flex-col items-end mt-20 pr-12">
        <div className="w-64 text-center space-y-4">
          <div className="border-b-2 border-gray-300 pb-2 min-h-[100px] flex items-center justify-center">
            {user?.signatureUrl ? (
              <img src={user.signatureUrl} alt="Firma" className="max-h-24 mx-auto object-contain mb-2 print-force-visible" />
            ) : (
              <div className="h-24 w-full bg-gray-50 rounded-lg flex flex-col items-center justify-center border-2 border-dashed border-gray-200">
                <PenTool className="w-6 h-6 text-gray-300 mb-1" />
                <span className="text-[10px] text-gray-400 font-black uppercase">Firma Pendiente</span>
              </div>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-[8px] font-black uppercase tracking-[0.3em]">Validación Don Bosco Track</span>
            </div>
            <p className="text-sm font-black uppercase text-gray-800">{user?.name}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              {user?.role === 'docent' ? 'Firma del Docente' : 'Responsable de Auditoría'}
            </p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 20px; }
          .sidebar, header, nav { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .print-force-visible { display: block !important; visibility: visible !important; opacity: 1 !important; }
          img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .max-h-7xl { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
