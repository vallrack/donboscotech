
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Printer, 
  MapPin, ExternalLink, Download, 
  ShieldCheck, Filter
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AttendanceRecord, User, Campus } from '@/lib/types';

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

  const totalTimeHours = useMemo(() => {
    return dailyReports.reduce((acc, r) => acc + r.hours, 0);
  }, [dailyReports]);

  const handleExportExcel = () => {
    const BOM = "\uFEFF"; 
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
    <div className="space-y-6 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
          <p className="text-muted-foreground text-xs font-medium italic no-print">Sincronización geográfica en tiempo real.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" className="rounded-xl font-black gap-2 h-10 border-green-200 text-green-700 hover:bg-green-50 shadow-sm text-xs" onClick={handleExportExcel}>
            <Download className="w-3.5 h-3.5" /> Excel Oficial
          </Button>
          <Button onClick={() => window.print()} className="rounded-xl font-black gap-2 h-10 px-5 shadow-md text-xs">
            <Printer className="w-3.5 h-3.5" /> PDF Institucional
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 no-print">
        <Card className="md:col-span-4 bg-white p-3 rounded-2xl shadow-lg border-none flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px] space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Periodo</p>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="rounded-lg font-bold bg-gray-50 border-none h-9 text-xs shadow-inner"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Semana Actual" className="text-xs">Semana Actual</SelectItem>
                <SelectItem value="Mes Actual" className="text-xs">Mes Actual</SelectItem>
                <SelectItem value="Todo el Historial" className="text-xs">Todo el Historial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isDocent && (
            <>
              <div className="flex-1 min-w-[140px] space-y-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Personal</p>
                <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                  <SelectTrigger className="rounded-lg font-bold bg-gray-50 border-none h-9 text-xs shadow-inner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[120px] space-y-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sede</p>
                <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                  <SelectTrigger className="rounded-lg font-bold bg-gray-50 border-none h-9 text-xs shadow-inner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas</SelectItem>
                    {campuses.map(c => <SelectItem key={c.id} value={c.name} className="text-xs">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </Card>
        <Card className="bg-primary text-white rounded-2xl shadow-lg flex flex-col items-center justify-center p-3 border-none">
           <p className="text-[8px] font-black uppercase tracking-widest opacity-80 mb-0.5 text-center">TOTAL ACUMULADO</p>
           <h3 className="text-lg font-black">{formatDuration(totalTimeHours)}</h3>
        </Card>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden print:shadow-none print:border print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-6 flex flex-row items-center justify-between no-print">
          <CardTitle className="text-lg font-black flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Registros de Actividad</CardTitle>
          <div className="bg-primary/5 px-3 py-1.5 rounded-lg text-primary font-black text-[10px] uppercase">
            {dailyReports.length} Registros Encontrados
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Personal</th>
                  <th className="px-6 py-4">Fecha / Jornada</th>
                  <th className="px-6 py-4">Horario</th>
                  <th className="px-6 py-4 no-print">Ubicación GPS</th>
                  <th className="px-6 py-4 text-center">Duración</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="animate-spin mx-auto opacity-20" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  <>
                    {dailyReports.map((r, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-all group">
                        <td className="px-6 py-4">
                          <div className="font-black text-xs text-gray-800">{r.userName}</div>
                          <div className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">{r.campus} • {r.documentId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[11px] font-bold">{r.date}</div>
                          <Badge variant="outline" className="text-[7px] font-black uppercase tracking-widest h-4 mt-0.5 border-primary/20 text-primary">
                            {r.shiftName}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-bold text-gray-600">
                          <div className="flex items-center gap-1.5">
                             <span className="text-green-600">{r.entry || '--:--'}</span>
                             <span className="opacity-20">→</span>
                             <span className="text-primary">{r.exit || '--:--'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 no-print">
                           {r.location?.lat !== 0 ? (
                             <a 
                              href={`https://www.google.com/maps?q=${r.location?.lat},${r.location?.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[8px] font-black text-primary hover:bg-primary/5 px-2 py-1 rounded-md transition-all border border-primary/10"
                             >
                               <MapPin className="w-3 h-3" /> Ver GPS <ExternalLink className="w-2 h-2" />
                             </a>
                           ) : (
                             <span className="text-[8px] text-muted-foreground italic opacity-30">Sin GPS</span>
                           )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className="font-black bg-green-500 text-white rounded-md px-2.5 py-1 text-[10px]">
                            {formatDuration(r.hours)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5">
                      <td colSpan={isDocent ? 3 : 4} className="px-6 py-6 text-right font-black text-[10px] uppercase tracking-widest text-primary">Sumatoria Total</td>
                      <td className="px-6 py-6 text-center">
                        <Badge className="font-black bg-primary text-white rounded-lg px-4 py-2 text-xs shadow-lg">
                          {formatDuration(totalTimeHours)}
                        </Badge>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground font-bold italic">No hay registros para este periodo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:flex flex-col items-end mt-16 pr-8">
        <div className="w-64 text-center space-y-3">
          <div className="border-b border-gray-300 pb-2 min-h-[100px] flex items-center justify-center bg-gray-50/30 rounded-t-xl">
            {user?.signatureUrl ? (
              <img src={user.signatureUrl} alt="Firma" className="max-h-20 mx-auto object-contain mix-blend-multiply" />
            ) : (
              <p className="text-[8px] text-muted-foreground italic uppercase tracking-widest opacity-20">Validación Electrónica</p>
            )}
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-black uppercase text-gray-800">{user?.name}</p>
            <p className="text-[8px] font-black text-primary uppercase tracking-widest">{user?.role === 'docent' ? 'Docente Titular' : 'Responsable de Auditoría'}</p>
          </div>
          <div className="flex items-center justify-center gap-1 text-primary/30 pt-1">
            <ShieldCheck className="w-3 h-3" />
            <span className="text-[7px] font-black uppercase tracking-[0.3em]">Autenticado: Don Bosco Track</span>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background-color: white !important; }
          .print-hidden { display: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #f3f4f6 !important; }
        }
      `}</style>
    </div>
  );
}
