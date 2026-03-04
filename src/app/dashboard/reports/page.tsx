
"use client"

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Loader2, Calendar, TrendingUp, Download, FileText, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ReportsPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const [period, setPeriod] = useState('Mes Actual');
  const [viewType, setViewType] = useState<'weekly' | 'monthly'>('monthly');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  // Fetch Global Records
  const recordsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db]);

  const { data: records, loading } = useCollection(recordsQuery as any);

  // Mock data for charts based on real count or fallback
  const chartData = useMemo(() => {
    if (viewType === 'monthly') {
      return [
        { name: 'Semana 1', asistencia: 85 },
        { name: 'Semana 2', asistencia: 92 },
        { name: 'Semana 3', asistencia: 88 },
        { name: 'Semana 4', asistencia: 95 },
      ];
    } else {
      return [
        { name: 'Lun', asistencia: 98 },
        { name: 'Mar', asistencia: 95 },
        { name: 'Mie', asistencia: 85 },
        { name: 'Jue', asistencia: 90 },
        { name: 'Vie', asistencia: 92 },
      ];
    }
  }, [viewType]);

  const handleGenerateAiSummary = async () => {
    if (!records || records.length === 0) {
      toast({ title: "Sin datos", description: "No hay registros suficientes para analizar.", variant: "destructive" });
      return;
    }
    
    setGeneratingAi(true);
    try {
      const reportData = records.slice(0, 50).map((r: any) => ({
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
        reportingPeriod: period
      });
      setAiSummary(result);
    } catch (err) {
      toast({ title: "Error de IA", variant: "destructive" });
    } finally {
      setGeneratingAi(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Reportes Administrativos</h1>
          <p className="text-muted-foreground font-medium">Análisis de asistencia y cumplimiento institucional.</p>
        </div>
        <div className="flex gap-3">
           <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48 h-12 rounded-2xl font-bold bg-white shadow-sm border-gray-200">
              <Calendar className="w-4 h-4 mr-2 text-primary" />
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Semana Actual">Semana Actual</SelectItem>
              <SelectItem value="Mes Actual">Mes Actual</SelectItem>
              <SelectItem value="Año 2024">Año 2024</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-12 rounded-2xl font-bold gap-2 bg-white">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico Principal */}
        <Card className="lg:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black flex items-center gap-2">
                   <TrendingUp className="w-5 h-5 text-primary" /> Tendencias de Asistencia
                </CardTitle>
                <CardDescription>Visualización {viewType === 'monthly' ? 'mensual' : 'semanal'} de puntualidad.</CardDescription>
              </div>
              <Tabs value={viewType} onValueChange={(v: any) => setViewType(v)} className="w-auto">
                <TabsList className="bg-gray-100 rounded-xl h-10">
                  <TabsTrigger value="weekly" className="text-[10px] font-black uppercase px-4">Semana</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-[10px] font-black uppercase px-4">Mes</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-6 h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 800 }}
                />
                <Bar dataKey="asistencia" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Resumen IA */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-primary text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardHeader>
            <CardTitle className="text-xl font-black flex items-center gap-2">
              <Sparkles className="w-5 h-5" /> Análisis IA
            </CardTitle>
            <CardDescription className="text-primary-foreground/70">Resumen inteligente de hallazgos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiSummary ? (
              <div className="bg-white/10 p-5 rounded-3xl border border-white/10 text-sm leading-relaxed italic font-medium">
                "{aiSummary.summary}"
              </div>
            ) : (
              <div className="text-center py-10 space-y-4">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto">
                  <BarChart3 className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-sm opacity-80 font-medium px-4">Utiliza inteligencia artificial para detectar patrones de ausentismo o retrasos.</p>
                <Button 
                  onClick={handleGenerateAiSummary} 
                  disabled={generatingAi} 
                  variant="secondary" 
                  className="w-full h-12 rounded-2xl font-black"
                >
                  {generatingAi ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generar Resumen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" /> Documentación
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
             {[
               { id: 'rep-1', name: 'Consolidado de Nómina', format: 'XLSX', color: 'bg-green-100 text-green-700' },
               { id: 'rep-2', name: 'Kardex Docente Individual', format: 'PDF', color: 'bg-red-100 text-red-700' },
               { id: 'rep-3', name: 'Reporte de Horas Extras', format: 'CSV', color: 'bg-blue-100 text-blue-700' },
             ].map((doc) => (
               <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group">
                 <div className="flex items-center gap-4">
                   <div className={cn("p-2 rounded-xl", doc.color)}>
                     <FileText className="w-5 h-5" />
                   </div>
                   <span className="text-sm font-bold">{doc.name}</span>
                 </div>
                 <Badge variant="outline" className="text-[10px] font-black">{doc.format}</Badge>
               </div>
             ))}
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden">
          <CardHeader className="border-b bg-gray-50/50">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <LineChartIcon className="w-5 h-5 text-primary" /> Cumplimiento por Sede
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5">
               {[
                 { id: 'campus-1', name: 'Sede Norte', value: 95, color: 'bg-green-500' },
                 { id: 'campus-2', name: 'Sede Principal', value: 88, color: 'bg-primary' },
                 { id: 'campus-3', name: 'Sede Rural', value: 92, color: 'bg-blue-500' },
               ].map((c) => (
                 <div key={c.id} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                      <span>{c.name}</span>
                      <span>{c.value}%</span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                       <div className={cn("h-full transition-all duration-1000", c.color)} style={{ width: `${c.value}%` }} />
                    </div>
                 </div>
               ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

