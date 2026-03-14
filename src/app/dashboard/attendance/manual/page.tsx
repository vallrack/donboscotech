
"use client"

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, Loader2, MapPin, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Shift, User } from '@/lib/types';

export default function ManualAttendancePage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [markedUsers, setMarkedUsers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        null,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const docentsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), where('role', '==', 'docent'));
  }, [db]);

  const { data: allDocents, loading } = useCollection<User>(docentsQuery as any);

  const filteredDocents = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (allDocents || []).filter(u => 
      u.name?.toLowerCase().includes(search) || 
      u.email?.toLowerCase().includes(search)
    );
  }, [allDocents, searchTerm]);

  const toggleUser = (userId: string) => {
    setMarkedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSave = async () => {
    if (markedUsers.size === 0 || !db || !currentUser) return;
    
    setSaving(true);
    const now = new Date();
    const dateStr = now.toLocaleDateString('sv-SE');
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

    try {
      const shiftsSnap = await getDocs(collection(db, 'shifts'));
      const allShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      
      let processed = 0;

      for (const userId of Array.from(markedUsers)) {
        const docent = allDocents.find(d => d.id === userId);
        if (!docent) continue;

        // 1. Obtener jornada del docente para hoy
        const todayShifts = allShifts.filter(s => 
          docent.shiftIds?.includes(s.id) && s.days?.includes(dayName)
        );
        const activeShift = todayShifts[0];
        if (!activeShift) continue;

        // 2. Revisar si ya tiene entrada hoy para determinar el tipo (entry/exit)
        const q = query(
          collection(db, 'userProfiles', userId, 'attendanceRecords'), 
          where('date', '==', dateStr),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const lastRecSnap = await getDocs(q);
        const lastRec = !lastRecSnap.empty ? lastRecSnap.docs[0].data() : null;
        
        const recordType = lastRec && lastRec.type === 'entry' ? 'exit' : 'entry';
        
        // REGLA INSTITUCIONAL: Se marca la hora oficial de la jornada si es manual por coordinador
        const recordTime = recordType === 'entry' ? activeShift.startTime : activeShift.endTime;

        const recordId = `${userId}_${now.getTime()}_manual_coord`;
        const currentLoc = locationRef.current || { lat: 0, lng: 0 };
        
        const recordData = {
          userId, 
          userName: docent.name, 
          date: dateStr, 
          time: recordTime, 
          type: recordType,
          method: 'Manual', 
          shiftId: activeShift.id, 
          shiftName: activeShift.name,
          location: { 
            lat: currentLoc.lat, 
            lng: currentLoc.lng, 
            address: `Marcaje Manual - Coordinador: ${currentUser.name}` 
          },
          registeredBy: currentUser.id, 
          createdAt: serverTimestamp(),
          isVerified: true,
          verifiedBy: currentUser.id,
          verifiedByName: currentUser.name,
          verifiedBySignature: currentUser.signatureUrl || null,
          verifiedAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'userProfiles', userId, 'attendanceRecords', recordId), recordData);
        await setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData);
        processed++;
      }

      toast({
        title: "Registros Sincronizados",
        description: `Se han procesado ${processed} jornadas correctamente.`
      });
      setMarkedUsers(new Set());
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error en el servidor" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary">Validación de Coordinación</h1>
          <p className="text-muted-foreground text-sm font-medium">Marcaje manual con ajuste automático a horario institucional.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border rounded-2xl">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-[10px] font-black uppercase text-gray-400">Punto GPS Activo</span>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-6 border-b">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar docente por nombre..." 
              className="pl-10 h-11 border-gray-200 bg-gray-50/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Docente</th>
                  <th className="px-6 py-4">Sede / Programa</th>
                  <th className="px-6 py-4 text-center">Registrar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={3} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto opacity-20" /></td></tr>
                ) : filteredDocents.length > 0 ? (
                  filteredDocents.map((docent) => (
                    <tr key={docent.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-sm text-gray-800">{docent.name}</div>
                        <div className="text-[10px] text-muted-foreground font-bold">{docent.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[10px] font-black text-gray-500 uppercase">{docent.campus}</div>
                        <div className="text-[9px] font-bold text-primary">{docent.program}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <Checkbox 
                            checked={markedUsers.has(docent.id)}
                            onCheckedChange={() => toggleUser(docent.id)}
                            className="w-5 h-5 data-[state=checked]:bg-primary"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="py-20 text-center text-muted-foreground italic">No se encontraron docentes activos.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg" 
          disabled={markedUsers.size === 0 || saving}
          onClick={handleSave}
          className="px-12 h-14 text-lg font-black shadow-xl rounded-2xl gap-3"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-6 h-6" />}
          Aplicar Marcaje Administrativo ({markedUsers.size})
        </Button>
      </div>
    </div>
  );
}
