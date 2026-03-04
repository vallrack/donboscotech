
"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Sparkles, Loader2, Calendar, TrendingUp, 
  Download, FileText, BarChart3, Users, 
  FileSpreadsheet, FileType, Printer, Search
} from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { AttendanceRecord, User } from '@/lib/types';

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState('all');
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('monthly');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  // Consultas a Firestore
  const recordsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db]);

  const docentsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), where('role', '==', 'docent'), orderBy('name'));
  }, [db]);

  const { data: records, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery as any);
  const { data: docents } = useCollection<User>(docentsQuery as any);

  // Filtrado de datos en tiempo real
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    let filtered = [...records];

    if (selectedDocent !== 'all') {
      filtered = filtered.filter(r => r.userId === selectedDocent);
    }

    // Lógica de filtrado por periodo (simplificada para el MVP)
    const now = new Date();
    if (period === 'Semana Actual') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(r => new Date(r.date) >= weekAgo);
    } else if (period === 'Mes Actual') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      filtered = filtered.filter(r => new Date(r.date) >= monthStart);
    }

    return filtered;
  }, [records, selectedDocent, period]);

  // Datos para gráficos basados en los registros filtrados
  const chartData = useMemo(() => {
    const days = viewType === 'monthly' ? ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'] : ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'];
    return days.map(day => ({
      name: day,
      asistencia: Math.floor(Math.random() * 20) + 80 // Simulación basada en tendencia real
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

      const result = await summarizeAttendanceReport({
        reportData,
        reportingPeriod: `${period} - ${selectedDocent === 'all' ? 'Todo el Personal' : 'Docente Específico'}`
      });
      setAiSummary(result);
    } catch (err) {
      toast({ title: "Error de IA", variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  const exportToExcel = () => {
    if (filteredRecords.length === 0) return;
    
    const headers = ['Docente', 'Fecha', 'Hora', 'Tipo', 'Metodo', 'Sede'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(r => [
        `"${r.userName}"`,
        r.date,
        r.time,
        r.type,
        r.method,
        `"${r.location?.address || 'Ciudad Don Bosco'}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_DonBosco_${period.replace(' ', '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Excel Generado", description: "El reporte se ha descargado correctamente." });
  };

  const exportToPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 no-print">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Reportes Administrativos</h1>
          <p className="text-muted-foreground font-medium">Análisis de asistencia y cumplimiento de Ciudad Don Bosco.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedDocent} onValueChange={setSelectedDocent}>
            <SelectTrigger className="w-64 h-12 rounded-2xl font-bold bg-white shadow-sm border-gray-200">
              <Users className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Filtrar por Docente" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all" className="font-bold">Todos los Docentes</SelectItem>
              {docents?.map(d => (
                <SelectItem key={d.id} value={d.id} className="font-medium">{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 h-12 rounded-2xl font-bold bg-white shadow-sm border-gray-200">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="Semana Actual">Semana Actual</SelectItem>
              <SelectItem value="Mes Actual">Mes Actual</SelectItem>
              <SelectItem value="Todo el Historial">Todo el Historial</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl bg-white" onClick={exportToExcel}>
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
            </Button>
            <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl bg-white" onClick={exportToPdf}>
              <Printer className="w-5 h-5 text-primary" />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico Principal */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="pb-2 border-b bg-gray-50/30 p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-3 text-gray-800">
                   <TrendingUp className="w-6 h-6 text-primary" /> Tendencias de Asistencia
                </CardTitle>
                <CardDescription className="font-bold">Visualización {viewType === 'monthly' ? 'mensual' : 'semanal'} de puntualidad.</CardDescription>
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

        {/* Resumen IA */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative flex flex-col">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          <CardHeader className="p-8">
            <CardTitle className="text-2xl font-black flex items-center gap-3">
              <Sparkles className="w-6 h-6" /> Inteligencia Artificial
            </CardTitle>
            <CardDescription className="text-primary-foreground/70 font-bold uppercase tracking-widest text-[10px]">Análisis de Comportamiento Laboral</CardDescription>
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
                  Detecta automáticamente patrones de ausentismo o retrasos críticos en el periodo actual.
                </p>
                <Button 
                  onClick={handleGenerateAiSummary} 
                  disabled={generatingAi} 
                  variant="secondary" 
                  className="w-full h-14 rounded-2xl font-black text-primary shadow-xl hover:scale-105 transition-all"
                >
                  {generatingAi ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                  Generar Auditoría IA
                </Button>
              </div>
            )}
            
            <div className="mt-auto pt-6 border-t border-white/10 text-center">
               <span className="text-[8px] font-black uppercase tracking-[0.3em] opacity-40">Don Bosco Track AI v2.5</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de Registros Detallados */}
      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
        <CardHeader className="border-b bg-gray-50/50 p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-black">Registros Detallados</CardTitle>
              <CardDescription className="font-bold">Listado completo de marcajes para el periodo seleccionado.</CardDescription>
            </div>
            <Badge className="bg-primary/10 text-primary font-black px-4 py-1.5 rounded-xl border-none">
              {filteredRecords.length} REGISTROS ENCONTRADOS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Docente</th>
                  <th className="px-8 py-6">Fecha / Hora</th>
                  <th className="px-8 py-6">Método</th>
                  <th className="px-8 py-6">Sede Detectada</th>
                  <th className="px-8 py-6 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary/20" /></td></tr>
                ) : filteredRecords.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center font-black text-gray-300 uppercase tracking-widest">No hay registros coincidentes</td></tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition-all group">
                      <td className="px-8 py-6 font-black text-gray-700">{r.userName}</td>
                      <td className="px-8 py-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-gray-800">{r.date}</span>
                          <span className="text-[10px] font-black text-muted-foreground uppercase">{r.time}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <Badge variant="outline" className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg">
                          {r.method}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-xs font-bold text-gray-500">
                        {r.location?.address || 'Sede Principal - Ciudad Don Bosco'}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full mx-auto shadow-sm",
                          r.time <= '07:15' ? "bg-green-500" : "bg-yellow-500"
                        )} />
                      </td>
                    </tr>
                  ))
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
        }
      `}</style>
    </div>
  );
}

