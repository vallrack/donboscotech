
"use client"

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Calendar, TrendingUp, AlertCircle, Download, FileText } from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { MOCK_ATTENDANCE } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ReportsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState('Octubre 2023');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  const handleGenerateAiSummary = async () => {
    setGeneratingAi(true);
    try {
      const reportData = MOCK_ATTENDANCE.map(r => ({
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        entryTime: r.type === 'entry' ? r.time : undefined,
        exitTime: r.type === 'exit' ? r.time : undefined,
        isLate: r.type === 'entry' && r.time > '07:15',
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
          <h1 className="text-3xl font-bold tracking-tight text-primary">Reportes de Asistencia</h1>
          <p className="text-muted-foreground">Generación de archivos administrativos y análisis inteligente.</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-56 h-12 rounded-xl bg-white shadow-sm font-bold border-gray-200">
            <Calendar className="w-4 h-4 mr-2 text-primary" />
            <SelectValue placeholder="Periodo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Octubre 2023">Octubre 2023</SelectItem>
            <SelectItem value="Septiembre 2023">Septiembre 2023</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-xl bg-white rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Download className="w-5 h-5 text-primary" />
              Gestión de Documentos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-5 bg-gray-50 rounded-2xl border flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 text-green-700 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Consolidado Mensual (Excel)</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Nómina y Contabilidad</p>
                  </div>
               </div>
               <Button size="sm" variant="outline" className="rounded-lg font-bold">Exportar</Button>
            </div>
            <div className="p-5 bg-gray-50 rounded-2xl border flex items-center justify-between group hover:bg-white hover:shadow-md transition-all">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 text-red-700 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Kardex Docente (PDF)</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-black">Hoja de Vida Administrativa</p>
                  </div>
               </div>
               <Button size="sm" variant="outline" className="rounded-lg font-bold">Generar</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white rounded-3xl border-l-4 border-l-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-secondary" />
              Análisis Inteligente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {aiSummary ? (
              <div className="space-y-4">
                <div className="p-6 bg-secondary/5 rounded-2xl border border-secondary/20 italic text-sm leading-relaxed">
                   "{aiSummary.summary}"
                </div>
                <Button variant="ghost" className="text-secondary font-bold text-xs" onClick={handleGenerateAiSummary} disabled={generatingAi}>
                   {generatingAi ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                   Actualizar Análisis
                </Button>
              </div>
            ) : (
              <div className="text-center py-10">
                <Sparkles className="w-12 h-12 mx-auto text-gray-200 mb-4" />
                <p className="text-sm text-muted-foreground mb-6">Analiza patrones de puntualidad automáticamente.</p>
                <Button onClick={handleGenerateAiSummary} disabled={generatingAi} className="bg-secondary text-secondary-foreground font-bold rounded-xl h-12 px-8">
                  {generatingAi ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generar Resumen IA
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
