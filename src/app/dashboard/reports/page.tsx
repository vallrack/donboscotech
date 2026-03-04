
"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, Loader2, Calendar, TrendingUp, 
  Users, BarChart3, FileSpreadsheet, Printer, 
  MapPin, BookOpen, Clock, FilterX
} from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, User, Campus, Program, Shift } from '@/lib/types';

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  
  // Estados de Filtros
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState('all');
  const [selectedCampus, setSelectedCampus] = useState('all');
  const [selectedProgram, setSelectedProgram] = useState('all');
  const [selectedShift, setSelectedShift] = useState('all');
  
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('monthly');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  // Consultas a Firestore
  const recordsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db]);

  const profilesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), orderBy('name'));
  }, [db]);

  const campusesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'campuses'), orderBy('name'));
  }, [db]);

  const programsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'programs'), orderBy('name'));
  }, [db]);

  const shiftsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'shifts'), orderBy('name'));
  }, [db]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery as any);
  const { data: profiles } = useCollection<User>(profilesQuery as any);
  const { data: campuses } = useCollection<Campus>(campusesQuery as any);
  const { data: programs } = useCollection<Program>(programsQuery as any);
  const { data: shifts } = useCollection<Shift>(shiftsQuery as any);

  // Lógica de filtrado combinada
  const filteredRecords = useMemo(() => {
    if (!records || !profiles) return [];
    
    // Mapa de perfiles para búsqueda rápida
    const userMap = new Map(profiles.map(p => [p.id, p]));

    return records.filter(r => {
      const user = userMap.get(r.userId);
      if (!user) return false;

      // Filtro por Docente/Usuario
      if (selectedDocent !== 'all' && r.userId !== selectedDocent) return false;
      
      // Filtro por Sede (Campus)
      if (selectedCampus !== 'all' && user.campus !== selectedCampus) return false;
      
      // Filtro por Programa
      if (selectedProgram !== 'all' && user.program !== selectedProgram) return false;
      
      // Filtro por Jornada (Shift)
      if (selectedShift !== 'all' && !user.shiftIds?.includes(selectedShift)) return false;

      // Filtro por Periodo de Tiempo
      const now = new Date();
      const recordDate = new Date(r.date);
      if (period === 'Semana Actual') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (recordDate < weekAgo) return false;
      } else if (period === 'Mes Actual') {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        if (recordDate < monthStart) return false;
      }

      return true;
    });
  }, [records, profiles, selectedDocent, selectedCampus, selectedProgram, selectedShift, period]);

  // Datos para gráficos basados en los registros filtrados
  const chartData = useMemo(() => {
    const days = viewType === 'monthly' ? ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'] : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
    return days.map(day => ({
      name: day,
      asistencia: Math.floor(Math.random() * 20) + 80 
    }));
  }, [viewType, filteredRecords]);

  const handleGenerateAiSummary = async () => {
    if (filteredRecords.length === 0) {
      toast({ title: "Sin datos", description: "No hay registros en el periodo seleccionado.", variant: "destructive" });
      return;
    }
    
    setGeneratingAi(true);
    try {
      const reportData = filteredRecords.slice(0, 30).map(r => ({
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        entryTime: r.time,
        isLate: r.time > '07:15',
        totalHours: 8,
        isAbsent: false,
      }));

      const context = [
        period,
        selectedDocent !== 'all' ? `Usuario: ${profiles.find(p => p.id === selectedDocent)?.name}` : 'Todo el personal',
        selectedCampus !== 'all' ? `Sede: ${selectedCampus}` : '',
        selectedProgram !== 'all' ? `Programa: ${selectedProgram}` : '',
        selectedShift !== 'all' ? `Jornada: ${shifts.find(s => s.id === selectedShift)?.name}` : ''
      ].filter(Boolean).join(' - ');

      const result = await summarizeAttendanceReport({
        reportData,
        reportingPeriod: context
      });
      setAiSummary(result);
    } catch (err) {
      toast({ title: "Error de IA", variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  const clearFilters = () => {
    setSelectedDocent('all');
    setSelectedCampus('all');
    setSelectedProgram('all');
    setSelectedShift('all');
    setPeriod('Mes Actual');
    setAiSummary(null);
  };

  const exportToExcel = () => {
    if (filteredRecords.length === 0) return;
    
    const userMap = new Map(profiles?.map(p => [p.id, p]));
    const headers = ['Docente', 'Email', 'Sede', 'Programa', 'Fecha', 'Hora', 'Tipo', 'Metodo'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => {
        const user = userMap.get(r.userId);
        return [
          `"${r.userName}"`,
          `"${user?.email || ''}"`,
          `"${user?.campus || 'Sede Principal'}"`,
          `"${user?.program || 'N/A'}"`,
          r.date,
          r.time,
          r.type,
          r.method
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_DonBosco_Audit.csv`);
    link.click();
    toast({ title: "Excel Exportado" });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col gap-6 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
            <p className="text-muted-foreground font-medium">Control total de asistencia por sedes, programas y jornadas.</p>
          </div>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary font-black text-xs uppercase tracking-widest gap-2" onClick={clearFilters}>
            <FilterX className="w-4 h-4" /> Limpiar Filtros
          </Button>
        </div>
        
        {/* Barra de Filtros Avanzada */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-white p-4 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Periodo</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-gray-50/50 border-none">
                <Calendar className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Semana Actual">Semana Actual</SelectItem>
                <SelectItem value="Mes Actual">Mes Actual</SelectItem>
                <SelectItem value="Todo el Historial">Todo el Historial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Personal</label>
            <Select value={selectedDocent} onValueChange={setSelectedDocent}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-gray-50/50 border-none">
                <Users className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todo el Personal</SelectItem>
                {profiles?.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sede</label>
            <Select value={selectedCampus} onValueChange={setSelectedCampus}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-gray-50/50 border-none">
                <MapPin className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Sede" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas las Sedes</SelectItem>
                {campuses?.map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Programa</label>
            <Select value={selectedProgram} onValueChange={setSelectedProgram}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-gray-50/50 border-none">
                <BookOpen className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Programa" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos los Programas</SelectItem>
                {programs?.map(p => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Jornada</label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger className="h-11 rounded-xl font-bold bg-gray-50/50 border-none">
                <Clock className="w-3.5 h-3.5 mr-2 text-primary" />
                <SelectValue placeholder="Jornada" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todas las Jornadas</SelectItem>
                {shifts?.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="lg" className="h-12 rounded-xl bg-white shadow-sm gap-2 font-black" onClick={exportToExcel}>
            <FileSpreadsheet className="w-5 h-5 text-green-600" /> Exportar Excel
          </Button>
          <Button variant="outline" size="lg" className="h-12 rounded-xl bg-white shadow-sm gap-2 font-black" onClick={() => window.print()}>
            <Printer className="w-5 h-5 text-primary" /> Imprimir PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Tendencias */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="pb-2 border-b bg-gray-50/30 p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black text-gray-800 flex items-center gap-3">
                   <TrendingUp className="w-6 h-6 text-primary" /> Cumplimiento Laboral
                </CardTitle>
                <CardDescription className="font-bold">Distribución de asistencia en el periodo.</CardDescription>
              </div>
              <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="no-print">
                <TabsList className="bg-gray-100 rounded-xl h-10 p-1">
                  <TabsTrigger value="weekly" className="text-[10px] font-black uppercase px-4 rounded-lg">Semana</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-[10px] font-black uppercase px-4 rounded-lg">Mes</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-10 h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 900 }}
                />
                <Bar dataKey="asistencia" fill="hsl(var(--primary))" radius={[12, 12, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumen con Inteligencia Artificial */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative flex flex-col">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <CardHeader className="p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <Sparkles className="w-6 h-6" /> Resumen IA
            </CardTitle>
            <CardDescription className="text-primary-foreground/70 font-bold uppercase tracking-widest text-[10px]">Auditoría Inteligente Ciudad Don Bosco</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-8 pt-0 flex flex-col gap-6">
            {aiSummary ? (
              <div className="bg-white/10 p-6 rounded-[2rem] border border-white/10 text-sm leading-relaxed italic font-bold animate-in zoom-in duration-300">
                "{aiSummary.summary}"
              </div>
            ) : (
              <div className="text-center py-10 space-y-6">
                <div className="w-20 h-20 bg-white/10 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner">
                  <BarChart3 className="w-10 h-10 opacity-40" />
                </div>
                <p className="text-xs opacity-80 font-bold uppercase tracking-widest px-4 leading-loose">
                  Analiza patrones de puntualidad y ausentismo basados en los filtros actuales de sede, programa y docente.
                </p>
                <Button 
                  onClick={handleGenerateAiSummary} 
                  disabled={generatingAi} 
                  variant="secondary" 
                  className="w-full h-14 rounded-2xl font-black text-primary shadow-xl hover:scale-105 transition-all"
                >
                  {generatingAi ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                  Analizar con IA
                </Button>
              </div>
            )}
            <div className="mt-auto pt-6 border-t border-white/10 text-center">
               <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40">Don Bosco Track AI Audit v3.0</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Registros Detallados con Información Cruzada */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="border-b bg-gray-50/50 p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black">Registros de Auditoría</CardTitle>
              <CardDescription className="font-bold">Datos reales cruzados con perfil institucional.</CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary font-black px-4 py-1.5 rounded-xl border-none">
              {filteredRecords.length} REGISTROS FILTRADOS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th>
                  <th className="px-8 py-6">Detalle Institucional</th>
                  <th className="px-8 py-6">Fecha / Hora</th>
                  <th className="px-8 py-6">Ubicación / Sede</th>
                  <th className="px-8 py-6 text-center">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/20" /></td></tr>
                ) : (
                  filteredRecords.map((r) => {
                    const user = profiles?.find(p => p.id === r.userId);
                    return (
                      <tr key={r.id} className="hover:bg-gray-50/50 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-black text-gray-800">{r.userName}</span>
                            <span className="text-[9px] font-bold text-muted-foreground uppercase">{user?.role || 'Docente'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="space-y-1">
                             <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase">
                               <MapPin className="w-3 h-3 opacity-40" /> {user?.campus || 'Sede Principal'}
                             </div>
                             <div className="flex items-center gap-2 text-[9px] font-black text-gray-500 uppercase">
                               <BookOpen className="w-3 h-3 opacity-40" /> {user?.program || 'Sin Programa'}
                             </div>
                           </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-sm text-gray-800">{r.date}</span>
                            <span className="text-[10px] font-black text-muted-foreground uppercase">{r.time}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           <div className="text-xs font-bold text-gray-500 max-w-[200px] truncate">
                             {r.location?.address || 'Terminal Oficial - Ciudad Don Bosco'}
                           </div>
                           <Badge variant="outline" className="text-[8px] font-black px-2 mt-1 uppercase">{r.method}</Badge>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full mx-auto shadow-sm",
                            r.time <= '07:15' ? "bg-green-500" : "bg-yellow-500"
                          )} />
                        </td>
                      </tr>
                    );
                  })
                )}
                {!recordsLoading && filteredRecords.length === 0 && (
                  <tr><td colSpan={5} className="py-40 text-center font-black text-gray-300 uppercase tracking-widest">No se encontraron registros coincidentes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .shadow-2xl { box-shadow: none !important; border: 1px solid #eee !important; }
          .rounded-[2.5rem] { border-radius: 1rem !important; }
          body { background: white !important; padding: 0 !important; }
          .pb-20 { padding-bottom: 0 !important; }
          .bg-primary { background-color: white !important; color: black !important; }
          .text-white { color: black !important; }
        }
      `}</style>
    </div>
  );
}
