
"use client"

import { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ManualAttendancePage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [markedUsers, setMarkedUsers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);

  // Capturar ubicación del coordinador para el registro manual
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        () => toast({ title: "GPS Recomendado", description: "La ubicación ayuda a validar el registro manual.", variant: "default" })
      );
    }
  }, [toast]);

  const docentsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), where('role', '==', 'docent'));
  }, [db]);

  const { data: allDocents, loading } = useCollection(docentsQuery as any);

  const filteredDocents = useMemo(() => {
    return (allDocents || []).filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allDocents, searchTerm]);

  const toggleUser = (userId: string) => {
    const newMarked = new Set(markedUsers);
    if (newMarked.has(userId)) {
      newMarked.delete(userId);
    } else {
      newMarked.add(userId);
    }
    setMarkedUsers(newMarked);
  };

  const handleSave = () => {
    if (markedUsers.size === 0 || !db) return;
    
    setSaving(true);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    const savePromises = Array.from(markedUsers).map(userId => {
      const docent = allDocents.find(d => (d as any).id === userId);
      const recordId = `${userId}_${now.getTime()}_manual_admin`;
      
      const recordData = {
        userId,
        userName: docent?.name || 'Docente',
        date: dateStr,
        time: timeStr,
        type: 'entry',
        method: 'Manual',
        location: { 
          lat: locationRef.current?.lat || 0, 
          lng: locationRef.current?.lng || 0, 
          address: locationRef.current 
            ? `Validado por Coord: ${locationRef.current.lat.toFixed(6)}, ${locationRef.current.lng.toFixed(6)}` 
            : 'Registro Manual Administrativo' 
        },
        registeredBy: currentUser?.id,
        createdAt: serverTimestamp()
      };

      const userRecordRef = doc(db, 'userProfiles', userId, 'attendanceRecords', recordId);
      setDoc(userRecordRef, recordData).catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRecordRef.path,
          operation: 'create',
          requestResourceData: recordData
        }));
      });

      const globalRecordRef = doc(db, 'globalAttendanceRecords', recordId);
      return setDoc(globalRecordRef, recordData);
    });

    Promise.all(savePromises)
      .then(() => {
        toast({
          title: "Registros Guardados",
          description: `Se han registrado ${markedUsers.size} asistencias manualmente.`
        });
        setMarkedUsers(new Set());
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Marcaje Manual</h1>
          <p className="text-muted-foreground text-sm">Validación administrativa de asistencia para docentes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("px-4 py-2 rounded-xl border flex items-center gap-2 text-xs font-bold", location ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-500 border-gray-100")}>
            <MapPin className="w-3.5 h-3.5" /> {location ? "GPS Activo" : "GPS Inactivo"}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center gap-3 max-w-md shadow-sm">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <p className="text-[11px] text-yellow-800 font-semibold leading-relaxed">
              Esta acción queda registrada con su sello digital y será auditada en el cierre de nómina.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-6 border-b">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar docente por nombre o correo..." 
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
                  <th className="px-6 py-4 text-center">Registrar Hoy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr key="loading-manual-row">
                    <td colSpan={3} className="py-20 text-center">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground opacity-20" />
                    </td>
                  </tr>
                ) : (
                  filteredDocents.map((docent, index) => {
                    const docentId = (docent as any).id || `docent-${index}`;
                    return (
                      <tr key={docentId} className="hover:bg-gray-50/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm">{docent.name}</div>
                          <div className="text-[11px] text-muted-foreground">{docent.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant="outline" className="text-[10px] uppercase">Sin marcaje hoy</Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <Checkbox 
                              checked={markedUsers.has(docentId)}
                              onCheckedChange={() => toggleUser(docentId)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
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
          className="px-12 h-14 text-lg font-bold shadow-xl"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserCheck className="w-5 h-5 mr-2" />}
          Confirmar {markedUsers.size} registros
        </Button>
      </div>
    </div>
  );
}
