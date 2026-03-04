
"use client"

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { QrCode, MapPin, CheckCircle2, Loader2, ShieldCheck, Camera, Image as ImageIcon, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";
import { Shift } from '@/lib/types';

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [mode, setMode] = useState<'camera' | 'file'>('camera');
  
  const qrRegionId = "qr-reader";
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (mode === 'camera') getCameraPermission();
  }, [mode]);

  useEffect(() => {
    if (mode === 'camera' && hasCameraPermission) {
      html5QrCode.current = new Html5Qrcode(qrRegionId);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      html5QrCode.current.start({ facingMode: "environment" }, config, (decodedText) => registerAttendance(decodedText), () => {}).catch(() => {});
      return () => { if (html5QrCode.current?.isScanning) html5QrCode.current.stop().catch(() => {}); };
    }
  }, [mode, hasCameraPermission]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
          setLocationLoading(false);
        },
        (err) => {
          setLocationLoading(false);
          toast({ title: "GPS Requerido", description: "Debe habilitar el GPS para validar su presencia.", variant: "destructive" });
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [toast]);

  const registerAttendance = async (token: string) => {
    if (!db || !user || success || scanning) return;
    if (!locationRef.current) {
       toast({ variant: "destructive", title: "Esperando GPS", description: "Valide su ubicación antes de escanear." });
       return;
    };

    setScanning(true);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];
    
    try {
      // DETECCIÓN DE JORNADA ACTIVA
      let activeShift: Shift | null = null;
      if (user.shiftIds && user.shiftIds.length > 0) {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        const availableShifts = shiftsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Shift))
          .filter(s => user.shiftIds?.includes(s.id));
        
        activeShift = availableShifts.find(s => s.days?.includes(dayName)) || null;
      }

      const q = query(collection(db, 'userProfiles', user.id, 'attendanceRecords'), orderBy('createdAt', 'desc'), limit(1));
      const querySnap = await getDocs(q);
      let recordType: 'entry' | 'exit' = 'entry';
      if (!querySnap.empty) {
        const lastRecord = querySnap.docs[0].data();
        if (lastRecord.date === dateStr) recordType = lastRecord.type === 'entry' ? 'exit' : 'entry';
      }

      const recordId = `${user.id}_${now.getTime()}_mobile`;
      const recordData = {
        userId: user.id,
        userName: user.name,
        date: dateStr,
        time: timeStr,
        type: recordType,
        method: 'QR',
        shiftId: activeShift?.id || 'none',
        shiftName: activeShift?.name || 'Fuera de Horario',
        location: { lat: locationRef.current.lat, lng: locationRef.current.lng, address: 'Sede Ciudad Don Bosco' },
        createdAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      setScanning(false);
      setSuccess({ type: recordType, time: timeStr, shift: activeShift?.name });
      toast({ title: "Registro Sincronizado", description: `Jornada: ${activeShift?.name || 'No asignada'}` });

    } catch (err: any) {
      setScanning(false);
      toast({ variant: "destructive", title: "Error", description: "No se pudo sincronizar la asistencia." });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db) return;
    const scanner = new Html5Qrcode(qrRegionId);
    try {
      const decodedText = await scanner.scanFile(file, true);
      registerAttendance(decodedText);
    } catch (err) {
      toast({ variant: "destructive", title: "QR No Detectado", description: "Imagen no legible." });
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in duration-500 text-center">
        <div className={cn("w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-xl", success.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
          <CheckCircle2 className={cn("w-16 h-16", success.type === 'entry' ? "text-green-500" : "text-blue-500")} />
        </div>
        <h2 className="text-3xl font-black">{success.type === 'entry' ? "¡Bienvenido!" : "¡Buen Turno!"}</h2>
        <div className="bg-gray-50 p-6 rounded-3xl mt-6 space-y-1">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Jornada Registrada</p>
          <p className="text-lg font-black text-primary">{success.shift || 'Fuera de Horario'}</p>
          <p className="text-[10px] font-bold text-gray-400">{success.type === 'entry' ? 'Ingreso' : 'Salida'} a las {success.time}</p>
        </div>
        <Button className="mt-8 h-12 rounded-xl font-bold px-8 shadow-lg" onClick={() => window.location.href = '/dashboard'}>Volver al Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-primary text-white text-center py-10 relative overflow-hidden">
          <CardTitle className="text-3xl font-black">Registro Personal</CardTitle>
          <CardDescription className="text-primary-foreground/80 font-bold mt-2">Sincroniza tu jornada con el QR de la sede</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="flex p-1.5 bg-gray-100 rounded-2xl">
            <Button variant={mode === 'camera' ? 'default' : 'ghost'} className={cn("flex-1 rounded-xl font-black h-11", mode === 'camera' && "shadow-md")} onClick={() => setMode('camera')}>Cámara</Button>
            <Button variant={mode === 'file' ? 'default' : 'ghost'} className={cn("flex-1 rounded-xl font-black h-11", mode === 'file' && "shadow-md")} onClick={() => setMode('file')}>Imagen</Button>
          </div>
          <div id={qrRegionId} className={cn("w-full aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border-4 border-dashed border-gray-200 shadow-inner", mode === 'file' && "hidden")} />
          {mode === 'file' && (
            <div className="w-full aspect-square bg-gray-50 rounded-[2rem] flex flex-col items-center justify-center border-4 border-dashed border-gray-200 p-8 text-center space-y-4">
              <ImageIcon className="w-16 h-16 text-primary opacity-20" />
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="qr-upload" />
              <Button asChild className="rounded-xl font-black h-12 px-10"><label htmlFor="qr-upload" className="cursor-pointer">SELECCIONAR FOTO</label></Button>
            </div>
          )}
          <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
            <div className={cn("p-3 rounded-2xl", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>{locationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}</div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Geolocalización</p>
              <p className="text-xs font-black text-gray-700">{location ? "Sede Validada" : "Ubicando..."}</p>
            </div>
            {scanning && <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />}
          </div>
        </CardContent>
      </Card>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
