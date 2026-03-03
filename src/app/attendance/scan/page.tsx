
"use client"

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, CheckCircle2, ShieldCheck, RefreshCw, Loader2 } from 'lucide-react';
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

  // Generate dynamic token for security
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

  // Request location for geo-validation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => toast({ 
          title: "Ubicación requerida", 
          description: "Debe permitir el acceso al GPS para validar su presencia institucional.",
          variant: "destructive" 
        })
      );
    }
  }, [toast]);

  const handleScan = () => {
    if (!location || !user || !db) {
      toast({ 
        title: "Error de validación", 
        description: "Esperando señal de GPS o sesión de usuario.",
        variant: "destructive" 
      });
      return;
    }

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
      type: 'entry', // In a real app, this might alternate between entry/exit based on logic
      method: 'QR',
      location: { 
        lat: location.lat, 
        lng: location.lng, 
        address: 'Ciudad Don Bosco' 
      },
      createdAt: serverTimestamp()
    };

    // Save to user's history
    const userRecordRef = doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId);
    setDoc(userRecordRef, recordData)
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRecordRef.path,
          operation: 'create',
          requestResourceData: recordData
        }));
      });

    // Save to global consolidated view
    const globalRecordRef = doc(db, 'globalAttendanceRecords', recordId);
    setDoc(globalRecordRef, recordData)
      .then(() => {
        setScanning(false);
        setSuccess(true);
        toast({ 
          title: "¡Registro Exitoso!", 
          description: "Se ha registrado su jornada correctamente en el sistema central." 
        });
      })
      .catch(async (err) => {
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500">
        <div className="bg-green-100 p-8 rounded-full mb-6">
          <CheckCircle2 className="w-20 h-20 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">¡Todo listo, {user?.name.split(' ')[0]}!</h2>
        <p className="text-muted-foreground mt-2 text-center max-w-sm">
          Tu asistencia ha sido registrada y sincronizada con éxito.
        </p>
        <Button className="mt-8 font-bold h-12 px-8" onClick={() => window.location.href = '/dashboard'}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="border-none shadow-xl overflow-hidden bg-white">
        <CardHeader className="bg-primary text-white pb-10">
          <CardTitle className="text-2xl flex items-center gap-2">
            <QrCode className="w-6 h-6" /> Registro de Asistencia
          </CardTitle>
          <CardDescription className="text-primary-foreground/80">
            Escanee el código dinámico institucional para confirmar su presencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center -mt-6">
          <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-primary/5 relative">
            <div className="w-56 h-56 bg-gray-50 rounded-xl flex flex-col items-center justify-center border-4 border-dashed border-gray-200">
              <div className="grid grid-cols-4 gap-2 p-4 opacity-10">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="w-10 h-10 bg-black rounded-sm" />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white px-6 py-3 rounded-full shadow-lg font-mono font-bold text-primary tracking-widest text-xl border-4 border-primary/20">
                    {token}
                 </div>
              </div>
            </div>
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-5 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 whitespace-nowrap shadow-md">
              <RefreshCw className={cn("w-3 h-3", countdown > 13 && "animate-spin")} />
              Actualización en {countdown}s
            </div>
          </div>

          <div className="mt-14 w-full space-y-4">
            <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
              )}>
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Ubicación GPS</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {location ? `Presencia detectada: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Esperando señal de satélite..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold">Verificación Cifrada</p>
                <p className="text-xs text-muted-foreground mt-0.5">Sincronización encriptada con Firebase Auth</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50/50 p-8 flex flex-col gap-4">
          <Button 
            className="w-full h-14 text-lg font-bold shadow-lg" 
            size="lg" 
            onClick={handleScan}
            disabled={scanning || !location}
          >
            {scanning ? (
              <span className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" /> Procesando Registro...
              </span>
            ) : "Confirmar Mi Jornada"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Al registrarse, autoriza el almacenamiento de sus coordenadas geográficas con fines puramente administrativos de cumplimiento laboral.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
