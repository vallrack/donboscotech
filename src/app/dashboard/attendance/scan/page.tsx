
"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, CheckCircle2, RefreshCw, Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(15);

  useEffect(() => {
    const generateToken = () => {
      setToken(Math.random().toString(36).substring(2, 10).toUpperCase());
      setCountdown(15);
    };

    generateToken();
    const interval = setInterval(generateToken, 15000);
    const timer = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 15), 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => toast({ 
          title: "Ubicación requerida", 
          description: "Debe permitir el acceso al GPS para validar su presencia.",
          variant: "destructive" 
        })
      );
    }
  }, [toast]);

  const handleScan = () => {
    if (!location || !user || !db) return;

    setScanning(true);
    const now = new Date();
    const recordId = `${user.id}_${now.getTime()}`;
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    
    const recordData = {
      userId: user.id,
      userName: user.name,
      date: dateStr,
      time: timeStr,
      type: 'entry',
      method: 'QR',
      location: { lat: location.lat, lng: location.lng, address: 'Ciudad Don Bosco' },
      createdAt: serverTimestamp()
    };

    const userRecordRef = doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId);
    setDoc(userRecordRef, recordData)
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRecordRef.path,
          operation: 'create',
          requestResourceData: recordData
        }));
      });

    const globalRecordRef = doc(db, 'globalAttendanceRecords', recordId);
    setDoc(globalRecordRef, recordData)
      .then(() => {
        setScanning(false);
        setSuccess(true);
      })
      .catch((err) => {
        setScanning(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: globalRecordRef.path,
          operation: 'create',
          requestResourceData: recordData
        }));
      });
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in duration-500">
        <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
        <h2 className="text-3xl font-bold">¡Asistencia Registrada!</h2>
        <p className="text-muted-foreground mt-2">Tu jornada ha sido sincronizada correctamente.</p>
        <Button className="mt-8" onClick={() => window.location.href = '/dashboard'}>Volver al Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-3xl">
        <CardHeader className="bg-primary text-white text-center py-10">
          <CardTitle className="text-3xl font-black">Registro de Entrada</CardTitle>
          <CardDescription className="text-primary-foreground/80 font-medium">
            Confirma tu presencia institucional hoy
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center p-8">
          <div className="relative p-8 bg-white rounded-[2rem] shadow-xl border border-gray-100">
             <div className="w-48 h-48 bg-gray-50 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-200">
                <span className="text-2xl font-mono font-black text-primary tracking-widest">{token}</span>
             </div>
             <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1.5 rounded-full text-[10px] font-black flex items-center gap-2 shadow-lg">
                <RefreshCw className={cn("w-3 h-3", countdown > 13 && "animate-spin")} />
                ACTUALIZACIÓN EN {countdown}S
             </div>
          </div>

          <div className="mt-12 w-full space-y-3">
             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                <div className={cn("p-2 rounded-xl", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                   <MapPin className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-xs font-bold uppercase tracking-tight">Geolocalización</p>
                   <p className="text-[10px] text-muted-foreground">{location ? "GPS Activo - Zona Don Bosco" : "Esperando señal satelital..."}</p>
                </div>
             </div>
             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                   <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                   <p className="text-xs font-bold uppercase tracking-tight">Cifrado de Sesión</p>
                   <p className="text-[10px] text-muted-foreground">Conexión segura vía Firebase Auth</p>
                </div>
             </div>
          </div>
        </CardContent>
        <CardFooter className="p-8">
           <Button className="w-full h-14 text-lg font-black rounded-2xl shadow-lg shadow-primary/20" disabled={!location || scanning} onClick={handleScan}>
              {scanning ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Confirmar Mi Jornada
           </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
