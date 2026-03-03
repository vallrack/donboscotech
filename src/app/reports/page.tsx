"use client"

import { useState } from 'react';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, Loader2, Calendar, TrendingUp, AlertCircle, Download } from 'lucide-react';
import { summarizeAttendanceReport, AiReportSummaryOutput } from '@/ai/flows/ai-report-summary';
import { MOCK_ATTENDANCE } from '@/lib/mock-data';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function ReportsPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState('October 2023');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiSummary, setAiSummary] = useState<AiReportSummaryOutput | null>(null);

  const handleGenerateAiSummary = async () => {
    setGeneratingAi(true);
    try {
      // Format data for AI
      const reportData = MOCK_ATTENDANCE.map(r => ({
        userId: r.userId,
        userName: r.userName,
        date: r.date,
        entryTime: r.type === 'entry' ? r.time : undefined,
        exitTime: r.type === 'exit' ? r.time : undefined,
        isLate: r.type === 'entry' && r.time > '07:15',
        totalHours: 8, // Simplified
        isAbsent: false,
      }));

      const result = await summarizeAttendanceReport({
        reportData,
        reportingPeriod: period
      });
      setAiSummary(result);
    } catch (err) {
      toast({
        title: "Error de IA",
        description: "No se pudo generar el resumen inteligente. Intente de nuevo.",
        variant: "destructive"
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExport = (type: 'pdf' | 'excel') => {
    toast({
      title: `Generando ${type.toUpperCase()}`,
      description: `El archivo para el periodo ${period} se descargará en unos momentos.`
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Reportes & Estadísticas</h1>
          <p className="text-muted-foreground">Generación de archivos administrativos y análisis inteligente.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
           <Calendar className="w-4 h-4 text-primary ml-2" />
           <Select value={period} onValueChange={setPeriod}>
             <SelectTrigger className="w-[180px] border-none focus:ring-0">
               <SelectValue placeholder="Seleccionar Periodo" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="October 2023">Octubre 2023</SelectItem>
               <SelectItem value="September 2023">Septiembre 2023</SelectItem>
               <SelectItem value="August 2023">Agosto 2023</SelectItem>
             </SelectContent>
           </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-none shadow-md bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Exportar Datos
            </CardTitle>
            <CardDescription>
              Descargue los registros brutos para procesamiento de nómina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Resumen de Horas (Excel/CSV)</p>
                <p className="text-xs text-muted-foreground">Ideal para procesos de contabilidad.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleExport('excel')}>
                Descargar
              </Button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Registro Detallado (PDF)</p>
                <p className="text-xs text-muted-foreground">Formato visual para carpetas docentes.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleExport('pdf')}>
                Generar PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white border-l-4 border-l-secondary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-secondary" />
              Resumen con Inteligencia Artificial
            </CardTitle>
            <CardDescription>
              Análisis automático de tendencias, puntualidad y hallazgos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiSummary ? (
              <div className="bg-secondary/5 p-4 rounded-lg text-sm leading-relaxed border border-secondary/20 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-secondary font-bold mb-3">
                  <TrendingUp className="w-4 h-4" /> Hallazgos Clave
                </div>
                <div className="whitespace-pre-line text-foreground/80 italic">
                  "{aiSummary.summary}"
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="mt-4 text-xs text-secondary hover:text-secondary/80 p-0"
                  onClick={handleGenerateAiSummary}
                >
                  <Loader2 className={cn("w-3 h-3 mr-1", generatingAi && "animate-spin")} />
                  Regenerar análisis
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                <div className="bg-gray-100 p-4 rounded-full">
                  <Sparkles className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Utilice nuestra IA para extraer conclusiones valiosas de la asistencia de este periodo.
                </p>
                <Button 
                  onClick={handleGenerateAiSummary} 
                  disabled={generatingAi}
                  className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                >
                  {generatingAi ? (
                    <> <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analizando... </>
                  ) : (
                    <> <Sparkles className="w-4 h-4 mr-2" /> Generar Resumen IA </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm bg-white overflow-hidden">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl">Indicadores de Puntualidad - {period}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b">
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium mb-1">Puntualidad Global</p>
              <h3 className="text-4xl font-bold text-green-600">92%</h3>
              <p className="text-[10px] text-green-600 font-bold mt-1">↑ 2.4% vs mes anterior</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium mb-1">Promedio de Retraso</p>
              <h3 className="text-4xl font-bold text-yellow-600">4.5m</h3>
              <p className="text-[10px] text-yellow-600 font-bold mt-1">Límite permitido: 10m</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground font-medium mb-1">Ausentismo Injustificado</p>
              <h3 className="text-4xl font-bold text-primary">0.8%</h3>
              <p className="text-[10px] text-primary font-bold mt-1">Histórico más bajo del año</p>
            </div>
          </div>
          <div className="p-6">
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-primary" />
              Docentes con Mayor Horas Laboradas
            </h4>
            <div className="space-y-3">
              {[
                { name: 'Juan Pérez', hours: 168, status: 'Excedido' },
                { name: 'María García', hours: 160, status: 'Normal' },
                { name: 'Lucía Fernández', hours: 158, status: 'Normal' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-muted-foreground font-mono">0{idx+1}</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-bold">{item.hours}h</span>
                    <Badge variant={item.status === 'Excedido' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}