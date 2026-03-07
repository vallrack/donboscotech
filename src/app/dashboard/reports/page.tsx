
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
  Clock, UserCheck, Check, PenTool, ShieldAlert
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
  const [globalVerifying, setGlobalVerifying] = useState(false);

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
          docentSignature: uData?.signatureUrl || null,
          isVerified: false,
          verifiedByName: '',
          verifiedBySignature: ''
        });
      }
      
      const dayData = grouped.get(key);
      if (r.type === 'entry') { 
        if (!dayData.entry || r.time < dayData.entry) dayData.entry = r.time; 
      } else { 
        if (!dayData.exit || r.time > dayData.exit) dayData.exit = r.time; 
      }

      // IMPORTANTE: Solo tomar la firma del docente de sus propios registros
      if (r.docentSignature) dayData.docentSignature = r.docentSignature;
      
      // IMPORTANTE: Solo marcar como verificado si el registro tiene firma de coordinador real
      if (r.isVerified && r.verifiedBySignature) {
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
  }, [records, profiles, period]);

  const totalTimeHours = useMemo(() => {
    return dailyReports.reduce((acc, r) => acc + (r.hours || 0), 0);
  }, [dailyReports]);

  const handleVerifyDay = async (report: any) => {
    if (!db || !user || verifyingId) return;
    
    if (!user.signatureUrl) {
      toast({
        variant: "destructive",
        title: "Firma Faltante",
        description: "Debes subir tu firma digital en tu perfil para firmar informes."
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
      toast({ title: "Informe Firmado", description: `Vo.Bo. de ${user.name} aplicado correctamente.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al firmar" });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSignAll = async () => {
    if (!db || !user || globalVerifying) return;
    if (!user.signatureUrl) {
      toast({ variant: "destructive", title: "Firma Faltante", description: "Configura tu firma en Mi Perfil." });
      return;
    }

    setGlobalVerifying(true);
    try {
      const batch = writeBatch(db);
      const pendingReports = dailyReports.filter(r => !r.isVerified && r.entry && r.exit);
      
      for (const report of pendingReports) {
        const userRecordsRef = collection(db, 'userProfiles', report.userId, 'attendanceRecords');
        const q = query(userRecordsRef, where('date', '==', report.date));
        const snapshot = await getDocs(q);
        
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
      }

      await batch.commit();
      toast({ title: "Firma Global Exitosa", description: "Todos los registros pendientes han sido firmados." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setGlobalVerifying(false);
    }
  };

  const handleExportExcel = () => {
    const BOM = "\uFEFF"; 
    const sep = ";";
    const headers = ["Personal", "Cédula", "Sede", "Fecha", "Jornada", "Entrada", "Salida", "Duración", "Estado", "Firmado Por"];
    const rows = dailyReports.map(r => [
      r.userName, r.documentId, r.campus, r.date, r.shiftName,
      r.entry || "--:--", r.exit || "--:--", formatDuration(r.hours),
      r.isVerified ? "VALIDADO" : (r.exit ? "CUMPLIDO" : "PENDIENTE"), r.verifiedByName || "N/A"
    ]);
    const csvContent = headers.join(sep) + "\n" + rows.map(row => row.map(cell => `"${cell}"`).join(sep)).join("\n");
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_DonBosco_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Determinar los datos para el pie de firma en el PDF
  const reportSummary = useMemo(() => {
    if (dailyReports.length === 0) return null;
    const first = dailyReports[0];
    const verified = dailyReports.find(r => r.isVerified && r.verifiedBySignature);
    return {
      docentName: isDocent ? user?.name : (selectedDocent !== 'all' ? activeDocentProfile?.name : 'Personal Ciudad Don Bosco'),
      docentSignature: isDocent ? user?.signatureUrl : (selectedDocent !== 'all' ? activeDocentProfile?.signatureUrl : null),
      coordinatorName: verified?.verifiedByName || 'Auditoría Técnica',
      coordinatorSignature: verified?.verifiedBySignature || null
    };
  }, [dailyReports, activeDocentProfile, isDocent, user, selectedDocent]);

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
          {isPrivileged && (
            <Button variant="default" size="sm" onClick={handleSignAll} disabled={globalVerifying} className="rounded-xl font-black h-9 px-6 bg-primary shadow-lg gap-2">
              {globalVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenTool className="w-4 h-4" />}
              FIRMAR TODO EL PERIODO
            </Button>
          )}
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
                  <th className="px-10 py-6 text-center print:hidden">Validación Técnica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recordsLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground"><Loader2 className="animate-spin mx-auto opacity-20 w-10 h-10 print:hidden" /></td></tr>
                ) : dailyReports.length > 0 ? (
                  <>
                    {dailyReports.map((r, idx) => {
                      const isCurrentVerifying = verifyingId === `${r.userId}_${r.date}`;
                      const isFulfilledByDocent = !!r.exit;
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
                          </td>
                          <td className="px-10 py-8 text-center">
                            <Badge className="font-black bg-gray-100 text-gray-500 text-[10px] px-3 py-1.5 rounded-lg border-none shadow-none print:bg-transparent">{formatDuration(r.hours)}</Badge>
                          </td>
                          <td className="px-10 py-8 text-center print:hidden">
                            <div className="flex flex-col items-center gap-2">
                              {r.isVerified ? (
                                <Badge className="bg-green-600 font-black text-[8px] px-3 py-1 rounded-lg">VALIDADO: {r.verifiedByName}</Badge>
                              ) : isFulfilledByDocent ? (
                                <div className="flex flex-col items-center gap-1">
                                  <Badge className="bg-green-500 font-black text-[8px] px-3 py-1 rounded-lg">CUMPLIDO</Badge>
                                  {isPrivileged && (
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleVerifyDay(r)}
                                      disabled={isCurrentVerifying}
                                      className="h-8 rounded-lg bg-gray-800 font-black text-[9px] px-4 mt-1"
                                    >
                                      {isCurrentVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <PenTool className="w-3 h-3 mr-1" />}
                                      FIRMAR
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <Badge variant="outline" className="text-[8px] font-black opacity-40">EN PROCESO</Badge>
                              )}
                            </div>
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
                    
                    {/* Sección de Firmas Dinámicas en PDF */}
                    <tr className="hidden print:table-row">
                      <td colSpan={5} className="pt-32 pb-16 px-10">
                        <div className="grid grid-cols-3 items-end gap-10">
                          <div className="space-y-4 text-center">
                            <div className="h-24 flex items-center justify-center border-b-2 border-gray-200">
                               {reportSummary?.docentSignature && (
                                 <img src={reportSummary.docentSignature} alt="Firma Docente" className="max-h-full object-contain" />
                               )}
                            </div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Firma del Docente</p>
                            <p className="text-[8px] font-bold text-gray-400">{reportSummary?.docentName}</p>
                          </div>

                          <div className="text-center space-y-2 pb-1">
                             <p className="text-[11px] font-black text-primary tracking-tighter">CIUDAD DON BOSCO</p>
                             <p className="text-[7px] font-bold text-gray-400 uppercase tracking-[0.3em]">Sello Digital Track Sinc</p>
                          </div>

                          <div className="space-y-4 text-center">
                            <div className="h-24 flex items-center justify-center border-b-2 border-gray-200">
                               {reportSummary?.coordinatorSignature ? (
                                 <img src={reportSummary.coordinatorSignature} alt="Firma Coordinación" className="max-h-full object-contain" />
                               ) : (
                                 <div className="text-[8px] font-bold text-red-300 italic uppercase">Pendiente Vo.Bo. Coordinación</div>
                               )}
                            </div>
                            <p className="text-[10px] font-black uppercase text-gray-500">Vo.Bo. Coordinación</p>
                            <p className="text-[8px] font-bold text-gray-400">
                              {reportSummary?.coordinatorName}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr><td colSpan={5} className="py-20 text-center text-muted-foreground italic font-bold">No hay registros hoy.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @media print {
          @page { margin: 10mm; size: portrait; }
          body { background-color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}
