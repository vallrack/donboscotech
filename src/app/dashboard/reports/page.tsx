
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Printer, 
  MapPin, ExternalLink, Download, 
  Filter
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AttendanceRecord, User, Campus } from '@/lib/types';
import { cn } from '@/lib/utils';

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
  const db = useFirestore();
  
  const isDocent = user?.role === 'docent';
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState('all');

  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return (isDocent || (selectedDocent !== 'all' && !isDocent))
      ? query(collection(db, 'userProfiles', isDocent ? user.id : selectedDocent, 'attendanceRecords'), orderBy('date', 'desc'))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db, user?.id, isDocent, selectedDocent]);

  const profilesQuery = useMemoFirebase(() => db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);

  const { data: recordsRaw, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: profilesRaw } = useCollection<User>(profilesQuery);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const profiles = useMemo(() => profilesRaw || [], [profilesRaw]);

  const dailyReports = useMemo(() => {
    const userMap = new Map((profiles || []).map(p => [p.id, p]));
    const grouped = new Map<string, any>();

    records.forEach(r => {
      const uData = userMap.get(r.userId);
      if (!isDocent && selectedDocent !== 'all' && r.userId !== selectedDocent) return;

      const key = `${r.userId}_${r.date}_${r.shiftId || 'none'}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          userId: r.userId, 
          userName: r.userName || uData?.name || 'Desconocido', 
          date: r.date, 
          entry: null, 
          exit: null,
          shiftName: r.shiftName || 'N/A',
          campus: uData?.campus || 'Sede Principal',
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

    const now = new Date();
    return Array.from(grouped.values())
      .map(d => ({ ...d, hours: calculateHoursDecimal(d.entry, d.exit) }))
      .filter(r => {
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
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, profiles, selectedDocent, period, isDocent]);

  const totalTimeHours = useMemo(() => {
    return dailyReports.reduce((acc, r) => acc + (r.hours || 0), 0);
  }, [dailyReports]);

  const handleExportExcel = () => {
    const BOM = "\uFEFF"; 
    const sep = ";";
    const headers = ["Personal", "Cédula", "Sede", "Fecha", "Jornada", "Entrada", "Salida", "Duración", "Validación"];
    const metaData = [
      ["CIUDAD DON BOSCO - INFORME OFICIAL DE ASISTENCIA"],
      [`Periodo: ${period}`],
      [`Generado por: ${user?.name}`],
      [],
      headers
    ];
    const rows = dailyReports.map(r => [
      r.userName, r.documentId, r.campus, r.date, r.shiftName,
      r.entry || "--:--", r.exit || "--:--", formatDuration(r.hours), "Sello Digital Track"
    ]);
    rows.push([]);
    rows.push(["TOTAL ACUMULADO", "", "", "", "", "", "", formatDuration(totalTimeHours), "Don Bosco Track Sinc"]);
    const csvContent = metaData.concat(rows).map(row => row.map(cell => `"${cell}"`).join(sep)).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Reporte_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
          <p className="text-muted-foreground font-medium text-[10px] print:hidden">Control de jornadas Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl font-bold border-green-200 text-green-700 h-9 px-4">
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button size="sm" onClick={() => window.print()} className="rounded-xl font-bold h-9 px-4 shadow-md">
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 print:hidden items-end">
        <Card className="md:col-span-9 bg-white p-3 rounded-xl shadow-sm border-none flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[120px] space-y-1">
            <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Periodo</label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="rounded-lg font-bold bg-gray-50/50 border-none h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Semana Actual">Semana Actual</SelectItem>
                <SelectItem value="Mes Actual">Mes Actual</SelectItem>
                <SelectItem value="Todo el Historial">Todo el Historial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isDocent && (
            <div className="flex-1 min-w-[180px] space-y-1">
              <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Docente</label>
              <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                <SelectTrigger className="rounded-lg font-bold bg-gray-50/50 border-none h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </Card>
        
        <Card className="md:col-span-3 bg-primary text-white rounded-xl shadow-md flex flex-col items-center justify-center p-3 border-none h-[64px]">
           <p className="text-[8px] font-black uppercase opacity-70 tracking-widest">TOTAL ACUMULADO</p>
           <h3 className="text-lg font-black">{formatDuration(totalTimeHours)}</h3>
        </Card>
      </div>

      <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden print:shadow-none print:border print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-4 flex flex-row items-center justify-between print:hidden">
          <CardTitle className="text-sm font-black text-gray-800">Desglose de Actividad</CardTitle>
          <Badge className="font-black bg-primary/10 text-primary border-none px-3 py-1 rounded-lg text-[10px]">{dailyReports.length} Registros</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Personal</th>
                  <th className="px-6 py-4">Fecha / Jornada</th>
                  <th className="px-6 py-4">Marcaje</th>
                  <th className="px-6 py-4 print:hidden">Ubicación</th>
                  <th className="px-6 py-4 text-center">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto opacity-20 w-10 h-10" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  <>
                    {dailyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 transition-all">
                        <td className="px-6 py-4">
                          <div className="font-black text-[12px] text-gray-800">{r.userName}</div>
                          <div className="text-[9px] text-muted-foreground font-bold">{r.documentId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] font-bold">{r.date}</div>
                          <div className="text-[8px] font-black text-primary uppercase">{r.shiftName}</div>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-bold">
                           <span className="text-green-600">{r.entry || '--:--'}</span>
                           <span className="mx-1 opacity-20">→</span>
                           <span className="text-primary">{r.exit || '--:--'}</span>
                        </td>
                        <td className="px-6 py-4 print:hidden">
                           {r.location?.lat !== 0 ? (
                             <a 
                               href={`https://www.google.com/maps?q=${r.location?.lat},${r.location?.lng}`} 
                               target="_blank" 
                               className="text-[9px] font-black text-primary flex items-center gap-1 hover:underline bg-primary/5 px-2 py-1 rounded-md w-fit"
                             >
                               <MapPin className="w-3 h-3" /> Ver GPS
                             </a>
                           ) : <span className="text-[8px] text-muted-foreground/30 font-bold italic">Sin GPS</span>}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className="font-black bg-green-500 text-white text-[10px] px-3 py-1 rounded-lg border-none">{formatDuration(r.hours)}</Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5">
                      <td colSpan={4} className="px-6 py-6 text-right font-black text-[10px] uppercase text-primary tracking-widest print:col-span-4">TOTAL TIEMPO ACUMULADO</td>
                      <td className="px-6 py-6 text-center">
                        <Badge className="font-black bg-primary text-white px-4 py-1.5 rounded-lg text-[12px] border-none">{formatDuration(totalTimeHours)}</Badge>
                      </td>
                    </tr>
                    {/* Firma oficial solo para PDF */}
                    <tr className="hidden print:table-row">
                      <td colSpan={5} className="pt-20 pb-10 px-6">
                        <div className="flex justify-between items-end">
                          <div className="w-48 border-t-2 border-gray-400 pt-2">
                            <p className="text-[10px] font-black uppercase text-gray-500">Firma del Docente</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-primary">CIUDAD DON BOSCO</p>
                             <p className="text-[8px] font-bold text-gray-400">Sello Digital Track Sinc</p>
                          </div>
                          <div className="w-48 border-t-2 border-gray-400 pt-2">
                            <p className="text-[10px] font-black uppercase text-gray-500">Vo.Bo. Coordinación</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground italic font-bold">No hay registros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
