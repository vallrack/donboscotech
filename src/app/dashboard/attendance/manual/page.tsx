
"use client"

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, Loader2, MapPin } from 'lucide-react';
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
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

    try {
      const shiftsSnap = await getDocs(collection(db, 'shifts'));
      const allShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      
      let processed = 0;
      let blocked = 0;

      for (const userId of Array.from(markedUsers)) {
        const docent = allDocents.find(d => d.id === userId);
        if (!docent) continue;

        const todayShifts = allShifts.filter(s => 
          docent.shiftIds?.includes(s.id) && s.days?.includes(dayName)
        );

        let activeShift = todayShifts[0] || null; // En manual permitimos si hay al menos una jornada hoy

        if (!activeShift) {
          blocked++;
          continue;
        }

        const recordId = `${userId}_${now.getTime()}_manual_admin`;
        const currentLoc = locationRef.current || { lat: 0, lng: 0 };
        
        // AUTO-VALIDACIÓN CON FIRMA DEL COORDINADOR
        const recordData = {
          userId, 
          userName: docent.name, 
          date: dateStr, 
          time: timeStr, 
          type: 'entry',
          method: 'Manual', 
          shiftId: activeShift.id, 
          shiftName: activeShift.name,
          location: { 
            lat: currentLoc.lat, 
            lng: currentLoc.lng, 
            address: `Validado por: ${currentUser.name}` 
          },
          registeredBy: currentUser.id, 
          createdAt: serverTimestamp(),
          // Se agrega firma automáticamente ya que lo hace un coordinador
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
        title: "Proceso Finalizado",
        description: `Registrados y validados: ${processed}.`
      });
      setMarkedUsers(new Set());
    } catch (error) {
      toast({ variant: "destructive", title: "Error en el registro" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Marcaje Manual Administrativo</h1>
          <p className="text-muted-foreground text-sm">Validación directa con firma digital automática.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold bg-gray-50 text-gray-500 border-gray-100">
            <MapPin className="w-3.5 h-3.5" /> GPS Activo
          </div>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-6 border-b">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar docente..." 
              className="pl-10 h-11 border-gray-200"
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
                  <th className="px-6 py-4">Estado</th>
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
                        <div className="font-bold text-sm">{docent.name}</div>
                        <div className="text-[11px] text-muted-foreground">{docent.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">Revisión Pendiente</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <Checkbox 
                            checked={markedUsers.has(docent.id)}
                            onCheckedChange={() => toggleUser(docent.id)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3} className="py-20 text-center text-muted-foreground italic">No se encontraron docentes.</td></tr>
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
          className="px-12 h-14 text-lg font-bold shadow-xl rounded-2xl"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserCheck className="w-5 h-5 mr-2" />}
          Confirmar y Firmar {markedUsers.size} registros
        </Button>
      </div>
    </div>
  );
}
