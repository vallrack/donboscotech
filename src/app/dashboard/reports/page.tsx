
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Printer, 
  MapPin, Download, 
  ShieldCheck, CheckCircle2,
  Clock, UserCheck
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDocs, where, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { AttendanceRecord, User as UserType } from '@/lib/types';
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
  const { toast } = useToast();
  
  const isDocent = user?.role === 'docent';
  const isPrivileged = user?.role === 'admin' || user?.role === 'coordinator' || user?.role === 'secretary';
  
  const [period, setPeriod] = useState('Mes Actual');
  const [selectedDocent, setSelectedDocent] = useState('all');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const recordsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return (isDocent || (selectedDocent !== 'all' && !isDocent))
      ? query(collection(db, 'userProfiles', isDocent ? user.id : selectedDocent, 'attendanceRecords'), orderBy('date', 'desc'))
      : query(collection(db, 'globalAttendanceRecords'), orderBy('date', 'desc'));
  }, [db, user?.id, isDocent, selectedDocent]);

  const profilesQuery = useMemoFirebase(() => db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);

  const { data: recordsRaw, loading: recordsLoading } = useCollection<AttendanceRecord>(recordsQuery);
  const { data: profilesRaw } = useCollection<UserType>(profilesQuery);

  const records = useMemo(() => recordsRaw || [], [recordsRaw]);
  const profiles = useMemo(() => profilesRaw || [], [profilesRaw]);

  const activeDocentProfile = useMemo(() => {
    if (isDocent) return user;
    if (selectedDocent !== 'all') return profiles.find(p => p.id === selectedDocent);
    return null;
  }, [isDocent, user, selectedDocent, profiles]);

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
          shiftId: r.shiftId,
          shiftName: r.shiftName || 'N/A',
          campus: uData?.campus || 'Sede Principal',
          documentId: uData?.documentId || 'N/A',
          location: r.location || { lat: 0, lng: 0 },
          docentSignature: r.docentSignature || uData?.signatureUrl || null,
          isVerified: r.isVerified || false,
          verifiedByName: r.verifiedByName || '',
          verifiedBySignature: r.verifiedBySignature || ''
        });
      }
      
      const dayData = grouped.get(key);
      if (r.type === 'entry') { 
        if (!dayData.entry || r.time < dayData.entry) dayData.entry = r.time; 
      } else { 
        if (!dayData.exit || r.time > dayData.exit) dayData.exit = r.time; 
      }

      if (r.docentSignature) dayData.docentSignature = r.docentSignature;
      if (r.isVerified) {
        dayData.isVerified = true;
        dayData.verifiedByName = r.verifiedByName;
        dayData.verifiedBySignature = r.verifiedBySignature;
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

  const handleVerifyDay = async (report: any) => {
    if (!db || !user || verifyingId) return;
    
    if (!user.signatureUrl && (user.role === 'admin' || user.role === 'coordinator')) {
      toast({
        variant: "destructive",
        title: "Firma Faltante",
        description: "Debes subir tu firma digital en tu perfil para validar reportes."
      });
      return;
    }

    setVerifyingId(`${report.userId}_${report.date}`);
    try {
      const userRecordsRef = collection(db, 'userProfiles', report.userId, 'attendanceRecords');
      const q = query(userRecordsRef, where('date', '==', report.date));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnap => {
        const updateData = {
          isVerified: true,
          verifiedBy: user.id,
          verifiedByName: user.name,
          verifiedBySignature: user.signatureUrl || '',
          verifiedAt: new Date().toISOString()
        };
        batch.update(docSnap.ref, updateData);
        const globalRef = doc(db, 'globalAttendanceRecords', docSnap.id);
        batch.update(globalRef, updateData);
      });

      await batch.commit();
      toast({ title: "Jornada Validada", description: `Revisión técnica de ${report.userName} completada.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al validar" });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleExportExcel = () => {
    const BOM = "\uFEFF"; 
    const sep = ";";
    const headers = ["Personal", "Cédula", "Sede", "Fecha", "Jornada", "Entrada", "Salida", "Duración", "Estado", "Validado Por"];
    const rows = dailyReports.map(r => [
      r.userName, r.documentId, r.campus, r.date, r.shiftName,
      r.entry || "--:--", r.exit || "--:--", formatDuration(r.hours),
      r.isVerified ? "CUMPLIDO" : "PENDIENTE", r.verifiedByName || "N/A"
    ]);
    rows.push([]);
    rows.push(["TOTAL ACUMULADO", "", "", "", "", "", "", formatDuration(totalTimeHours), "", ""]);
    const csvContent = headers.join(sep) + "\n" + rows.map(row => row.map(cell => `"${cell}"`).join(sep)).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_DonBosco_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-700 pb-20">
      <div className="hidden print:flex justify-between items-center border-b-2 border-primary pb-6 mb-8">
        <div>
           <h1 className="text-4xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mt-1">Ciudad Don Bosco - Track Sinc</p>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-gray-400 uppercase">Generado el: {new Date().toLocaleDateString()}</p>
           <p className="text-[10px] font-black text-gray-400 uppercase">Periodo: {period}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tighter">Auditoría Institucional</h1>
          <p className="text-muted-foreground font-medium text-[10px]">Control de jornadas Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} className="rounded-xl font-bold border-green-200 text-green-700 h-9 px-4">
            <Download className="w-4 h-4 mr-2" /> Excel
          </Button>
          <Button size="sm" onClick={() => window.print()} className="rounded-xl font-bold h-9 px-4 shadow-md">
            <Printer className="w-4 h-4 mr-2" /> Imprimir PDF
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
              <label className="text-[9px] font-black uppercase text-muted-foreground ml-1">Personal</label>
              <Select value={selectedDocent} onValueChange={setSelectedDocent}>
                <SelectTrigger className="rounded-lg font-bold bg-gray-50/50 border-none h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los registros</SelectItem>
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

      <Card className="border-none shadow-xl rounded-[2rem] bg-white overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <CardHeader className="border-b bg-gray-50/50 p-4 flex flex-row items-center justify-between print:hidden">
          <CardTitle className="text-sm font-black text-gray-800">Desglose de Actividad</CardTitle>
          <Badge className="font-black bg-primary/10 text-primary border-none px-3 py-1 rounded-lg text-[10px]">{dailyReports.length} Registros</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-10 py-6">Personal</th>
                  <th className="px-10 py-6">Fecha / Jornada</th>
                  <th className="px-10 py-6">Marcaje</th>
                  <th className="px-10 py-6 text-center">Duración</th>
                  <th className="px-10 py-6 text-center print:hidden">Validación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto opacity-20 w-10 h-10 print:hidden" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  <>
                    {dailyReports.map((r, idx) => {
                      const isCurrentVerifying = verifyingId === `${r.userId}_${r.date}`;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-all border-b border-gray-50">
                          <td className="px-10 py-8">
                            <div className="font-black text-[13px] text-gray-800">{r.userName}</div>
                            <div className="text-[9px] text-muted-foreground font-bold tracking-widest">{r.documentId}</div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="text-[12px] font-bold text-gray-700">{r.date}</div>
                            <div className="text-[8px] font-black text-primary uppercase tracking-wider">{r.shiftName}</div>
                          </td>
                          <td className="px-10 py-8 text-[12px] font-bold">
                             <div className="flex items-center gap-2">
                               <span className="text-green-600">{r.entry || '--:--'}</span>
                               <span className="mx-1 opacity-20 print:hidden">→</span>
                               <span className="text-primary">{r.exit || '--:--'}</span>
                             </div>
                             {r.location?.lat !== 0 && (
                               <div className="print:hidden mt-2">
                                 <a 
                                   href={`https://www.google.com/maps?q=${r.location?.lat},${r.location?.lng}`} 
                                   target="_blank" 
                                   className="text-[8px] font-black text-primary/60 flex items-center gap-1 hover:underline bg-primary/5 px-2 py-1 rounded-md w-fit"
                                 >
                                   <MapPin className="w-2.5 h-2.5" /> Ver Punto Exacto
                                 </a>
                               </div>
                             )}
                          </td>
                          <td className="px-10 py-8 text-center">
                            <Badge className="font-black bg-gray-100 text-gray-500 text-[10px] px-3 py-1.5 rounded-lg border-none shadow-none print:bg-transparent">{formatDuration(r.hours)}</Badge>
                          </td>
                          <td className="px-10 py-8 text-center print:hidden">
                            {r.isVerified ? (
                              <div className="flex flex-col items-center gap-1">
                                <Badge className="bg-green-500 hover:bg-green-600 font-black text-[8px] px-3 py-1 rounded-lg">
                                  CUMPLIDO
                                </Badge>
                                <span className="text-[7px] font-bold text-muted-foreground uppercase">{r.verifiedByName}</span>
                              </div>
                            ) : isPrivileged ? (
                              <Button 
                                size="sm" 
                                onClick={() => handleVerifyDay(r)}
                                disabled={isCurrentVerifying}
                                className="h-8 rounded-lg bg-gray-800 hover:bg-black font-black text-[9px] px-4"
                              >
                                {isCurrentVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "VALIDAR"}
                              </Button>
                            ) : (
                              <Badge variant="outline" className="text-[8px] font-black opacity-40">PENDIENTE</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-gray-50/10">
                      <td colSpan={3} className="px-10 py-10 text-right font-black text-[10px] uppercase text-primary tracking-[0.2em] print:text-gray-800">TOTAL TIEMPO ACUMULADO</td>
                      <td className="px-10 py-10 text-center">
                        <Badge className="font-black bg-primary/5 text-primary px-6 py-2 rounded-xl text-[14px] border-none shadow-none print:text-gray-800">{formatDuration(totalTimeHours)}</Badge>
                      </td>
                      <td className="print:hidden"></td>
                    </tr>
                    
                    <tr className="hidden print:table-row">
                      <td colSpan={5} className="pt-32 pb-16 px-10">
                        <div className="grid grid-cols-3 items-end gap-10">
                          <div className="space-y-4 text-center">
                            <div className="h-20 flex items-center justify-center border-b-2 border-gray-200">
                               {(dailyReports.find(r => r.userId === activeDocentProfile?.id)?.docentSignature || activeDocentProfile?.signatureUrl) && (
                                 <img src={dailyReports.find(r => r.userId === activeDocentProfile?.id)?.docentSignature || activeDocentProfile?.signatureUrl} alt="Firma Docente" className="max-h-full object-contain" />
                               )}
                            </div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Firma del Docente</p>
                            <p className="text-[8px] font-bold text-gray-400">{activeDocentProfile?.name || 'N/A'}</p>
                          </div>

                          <div className="text-center space-y-2 pb-1">
                             <div className="w-12 h-12 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-2">
                               <ShieldCheck className="w-6 h-6 text-primary opacity-20 print:hidden" />
                             </div>
                             <p className="text-[11px] font-black text-primary tracking-tighter">CIUDAD DON BOSCO</p>
                             <p className="text-[7px] font-bold text-gray-400 uppercase tracking-[0.3em]">Sello Digital Track Sinc</p>
                          </div>

                          <div className="space-y-4 text-center">
                            <div className="h-20 flex items-center justify-center border-b-2 border-gray-200">
                               {dailyReports.some(r => r.isVerified && r.verifiedBySignature) ? (
                                 <img src={dailyReports.find(r => r.isVerified && r.verifiedBySignature)?.verifiedBySignature} alt="Firma Coordinación" className="max-h-full object-contain" />
                               ) : (
                                 <div className="text-[8px] font-bold text-red-300 italic">PENDIENTE</div>
                               )}
                            </div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Vo.Bo. Coordinación</p>
                            <p className="text-[8px] font-bold text-gray-400">
                              {dailyReports.find(r => r.isVerified)?.verifiedByName || 'Revisión Técnica'}
                            </p>
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

      <style jsx global>{`
        @media print {
          @page {
            margin: 10mm;
            size: portrait;
          }
          body { background-color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          main { padding: 0 !important; margin: 0 !important; }
          .max-w-7xl { max-width: 100% !important; padding: 0 !important; }
          header, .sidebar-trigger, [data-sidebar="trigger"], .print-hidden, svg, .lucide { display: none !important; }
          .print-card { border: none !important; box-shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #eee !important; }
          th, td { border: 1px solid #f3f4f6 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
