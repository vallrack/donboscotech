
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
  Download, PenTool, ShieldCheck, ExternalLink
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceRecord, User, Campus, Program } from '@/lib/types';

/**
 * Calcula las horas decimales a partir de strings de tiempo.
 */
function calculateHoursDecimal(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
    const totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    return Math.max(0, totalMinutes / 60);
  } catch (e) { return 0; }
}

/**
 * Formatea una duración decimal en un string amigable (ej. 11 min, 5h 29m).
 */
function formatDuration(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  if (totalMinutes === 0) return '0 min';
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

  // Consulta estabilizada en tiempo real
  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return (isDocent || (selectedDocent !== 'all' && !isDocent))
      ? query(collection(db, 'userProfiles', isDocent ? user.id : selectedDocent, 'attendanceRecords'), orderBy('date', 'desc'))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db, user?.id, isDocent, selectedDocent]);

  const profilesQuery = useMemoFirebase(() => db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);
  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);

  const { data: recordsRaw, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: profilesRaw } = useCollection<User>(profilesQuery);
  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const profiles = useMemo(() => profilesRaw || [], [profilesRaw]);
  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);

  // Lógica de reportes diarios agrupados y filtrados
  const dailyReports = useMemo(() => {
    const userMap = new Map(profiles.map(p => [p.id, p]));
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const uData = userMap.get(r.userId);
      
      if (!isDocent) {
        if (selectedDocent !== 'all' && r.userId !== selectedDocent) return;
        if (selectedCampus !== 'all' && uData?.campus !== selectedCampus) return;
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
          campus: uData?.campus || 'N/A',
          documentId: uData?.documentId || 'N/A',
          location: r.location || { lat: 0, lng: 0 }
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
  }, [records, profiles, selectedDocent, selectedCampus, period, isDocent]);

  // Sumatoria total de tiempos
  const totalTimeHours = useMemo(() => {
    return dailyReports.reduce((acc, r) => acc + r.hours, 0);
  }, [dailyReports]);

  // Exportación a Excel con metadatos y sumatoria
  const handleExportExcel = () => {
    const BOM = "\uFEFF"; // Byte Order Mark para asegurar tildes en Excel
    const sep = ";";
    const headers = ["Personal", "Cédula", "Sede", "Fecha", "Jornada", "Entrada", "Salida", "Duración", "Punto GPS", "Validación"];
    
    const metaData = [
      ["CIUDAD DON BOSCO - INFORME OFICIAL DE ASISTENCIA"],
      [`Periodo: ${period}`],
      [`Filtro Personal: ${selectedDocent === 'all' ? 'Todos' : profiles.find(p => p.id === selectedDocent)?.name}`],
      [`Filtro Sede: ${selectedCampus === 'all' ? 'Todas' : selectedCampus}`],
      [`Generado por: ${user?.name} (${user?.role})`],
      [`Fecha de Generación: ${new Date().toLocaleString()}`],
      [],
      headers
    ];

    const rows = dailyReports.map(r => [
      r.userName,
      r.documentId,
      r.campus,
      r.date,
      r.shiftName,
      r.entry || "--:--",
      r.exit || "--:--",
      formatDuration(r.hours),
      r.location?.lat !== 0 ? `${r.location?.lat}, ${r.location?.lng}` : "No Capturado",
      "Sello Digital Sincronizado"
    ]);

    // Fila de sumatoria total al final del Excel
    rows.push([]);
    rows.push(["TOTAL TIEMPO ACUMULADO", "", "", "", "", "", "", formatDuration(totalTimeHours), "", "Validación Don Bosco Track"]);

    const csvContent = metaData.concat(rows).map(row => row.map(cell => `"${cell}"`).join(sep)).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_Auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
          <p className="text-muted-foreground font-medium italic">Sincronización geográfica en tiempo real.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl font-black gap-2 h-11 border-green-200 text-green-700 hover:bg-green-50 shadow-sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> Excel Oficial
          </Button>
          <Button onClick={() => window.print()} className="rounded-xl font-black gap-2 h-11 px-6 shadow-md">
            <Printer className="w-4 h-4" /> PDF Institucional
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <Card className="md:col-span-3 bg-white p-4 rounded-[2rem] shadow-xl flex flex-wrap gap-3">
          <div className="flex-1 min-w-[150px] space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Periodo</p>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none h-12 shadow-inner"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Semana Actual">Semana Actual</SelectItem>
                <SelectItem value="Mes Actual">Mes Actual</SelectItem>
                <SelectItem value="Todo el Historial">Todo el Historial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isDocent && (
            <>
              <div className="flex-1 min-w-[150px] space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Personal</p>
                <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                  <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none h-12 shadow-inner"><SelectValue placeholder="Docente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Miembros</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[150px] space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-2">Sede</p>
                <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                  <SelectTrigger className="rounded-xl font-bold bg-gray-50 border-none h-12 shadow-inner"><SelectValue placeholder="Sede" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Sedes</SelectItem>
                    {campuses.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </Card>
        <Card className="bg-primary text-white rounded-[2rem] shadow-xl flex flex-col items-center justify-center p-6 transition-transform hover:scale-105">
           <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Total Tiempo Acumulado</p>
           <h3 className="text-3xl font-black">{formatDuration(totalTimeHours)}</h3>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none print:border print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-8 flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-black">Registros Georreferenciados</CardTitle>
          <div className="bg-primary/5 px-4 py-2 rounded-xl text-primary font-black text-xs">
            {dailyReports.length} Registros Activos
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Personal</th>
                  <th className="px-8 py-6">Fecha / Jornada</th>
                  <th className="px-8 py-6">Entrada → Salida</th>
                  <th className="px-8 py-6">Ubicación GPS</th>
                  <th className="px-8 py-6 text-center">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  <>
                    {dailyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-all group">
                        <td className="px-8 py-6">
                          <div className="font-black text-sm text-gray-800">{r.userName}</div>
                          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">{r.campus} • {r.documentId}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-xs font-bold">{r.date}</div>
                          <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest h-5 mt-1 border-primary/20 text-primary">
                            {r.shiftName}
                          </Badge>
                        </td>
                        <td className="px-8 py-6 text-xs font-bold text-gray-600">
                          <div className="flex items-center gap-2">
                             <span className="text-green-600">{r.entry || '--:--'}</span>
                             <span className="opacity-30">→</span>
                             <span className="text-primary">{r.exit || '--:--'}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                           {r.location?.lat !== 0 ? (
                             <a 
                              href={`https://www.google.com/maps?q=${r.location?.lat},${r.location?.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-[9px] font-black text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-all"
                             >
                               <MapPin className="w-3.5 h-3.5" />
                               Ver Punto Exacto <ExternalLink className="w-2.5 h-2.5" />
                             </a>
                           ) : (
                             <span className="text-[9px] text-muted-foreground italic opacity-50">GPS no capturado</span>
                           )}
                        </td>
                        <td className="px-8 py-6 text-center">
                          <Badge className="font-black bg-green-500 text-white rounded-lg px-3 py-1.5 shadow-sm">
                            {formatDuration(r.hours)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {/* Fila de Sumatoria Total al Final de la Tabla */}
                    <tr className="bg-primary/5">
                      <td colSpan={4} className="px-8 py-8 text-right font-black text-xs uppercase tracking-widest text-primary">Sumatoria Total del Periodo</td>
                      <td className="px-8 py-8 text-center">
                        <Badge className="font-black bg-primary text-white rounded-xl px-5 py-2.5 text-sm shadow-xl animate-in fade-in zoom-in duration-500">
                          {formatDuration(totalTimeHours)}
                        </Badge>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground font-bold italic">No se encontraron registros activos para estos criterios.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sello de Firma al Final para PDF/Impresión */}
      <div className="hidden print:flex flex-col items-end mt-24 pr-12">
        <div className="w-72 text-center space-y-4">
          <div className="border-b-2 border-gray-300 pb-2 min-h-[120px] flex items-center justify-center bg-gray-50/50 rounded-t-xl overflow-hidden">
            {user?.signatureUrl ? (
              <img src={user.signatureUrl} alt="Firma Digital" className="max-h-24 mx-auto object-contain mb-2 mix-blend-multiply" />
            ) : (
              <p className="text-[10px] text-muted-foreground italic uppercase tracking-widest opacity-30">Pendiente de Firma</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black uppercase text-gray-800">{user?.name}</p>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">{user?.role === 'docent' ? 'Docente Titular' : user?.role === 'coordinator' ? 'Coordinador Institucional' : user?.role}</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-primary/40 pt-2">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[8px] font-black uppercase tracking-[0.4em]">Validado: Don Bosco Track Sinc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
