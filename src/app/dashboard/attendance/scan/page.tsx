
"use client"

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, getDoc } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, MapPin, Camera, QrCode, AlertCircle, HandHelping, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";
import { Shift } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [manualSaving, setManualSaving] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  
  const qrRegionId = "qr-reader";
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        null,
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) { setHasCameraPermission(false); }
    };
    getCameraPermission();
  }, []);

  useEffect(() => {
    if (hasCameraPermission && !success && !isProcessing.current && !timeError) {
      const startScanner = async () => {
        try {
          if (html5QrCode.current?.isScanning) return;
          html5QrCode.current = new Html5Qrcode(qrRegionId);
          await html5QrCode.current.start(
            { facingMode: "environment" }, 
            { fps: 15, qrbox: { width: 250, height: 250 } }, 
            (decodedText) => registerAttendance(decodedText), 
            () => {}
          );
        } catch (err) {}
      };
      startScanner();
      return () => { 
        if (html5QrCode.current?.isScanning) html5QrCode.current.stop().catch(() => {});
      };
    }
  }, [hasCameraPermission, success, timeError]);

  const registerAttendance = async (token: string, method: 'QR' | 'Manual' = 'QR') => {
    if (!db || !user || success || isProcessing.current) return;
    
    isProcessing.current = true;
    setTimeError(null);
    if (method === 'Manual') setManualSaving(true);
    else setScanning(true);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const [currH, currM] = timeStr.split(':').map(Number);
    const currTotalMinutes = currH * 60 + currM;
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];
    
    try {
      const shiftsSnap = await getDocs(collection(db, 'shifts'));
      const allShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));
      
      const todayShifts = allShifts.filter(s => 
        user.shiftIds?.includes(s.id) && s.days?.includes(dayName)
      );

      let activeShift: Shift | null = null;
      let isWithinTimeRange = false;

      for (const s of todayShifts) {
        const [startH, startM] = s.startTime.split(':').map(Number);
        const [endH, endM] = s.endTime.split(':').map(Number);
        if (currTotalMinutes >= (startH * 60 + startM - 30) && currTotalMinutes <= (endH * 60 + endM + 60)) {
          activeShift = s;
          isWithinTimeRange = true;
          break;
        }
      }

      if (!isWithinTimeRange) {
        setTimeError(todayShifts.length > 0 
          ? `Jornada hoy: ${todayShifts.map(s => `${s.startTime}-${s.endTime}`).join(', ')}.`
          : "Sin jornada asignada para hoy."
        );
        setScanning(false); setManualSaving(false); isProcessing.current = false;
        return;
      }

      const q = query(collection(db, 'userProfiles', user.id, 'attendanceRecords'), orderBy('createdAt', 'desc'), limit(1));
      const querySnap = await getDocs(q);
      const lastRecord = !querySnap.empty ? querySnap.docs[0].data() : null;
      const recordType = lastRecord && lastRecord.date === dateStr && lastRecord.type === 'entry' ? 'exit' : 'entry';

      if (recordType === 'exit' && activeShift) {
        const [endH, endM] = activeShift.endTime.split(':').map(Number);
        if (currTotalMinutes < (endH * 60 + endM)) {
          setTimeError(`Salida bloqueada hasta las ${activeShift.endTime}.`);
          setScanning(false); setManualSaving(false); isProcessing.current = false;
          return;
        }
      }

      const recordId = `${user.id}_${now.getTime()}_${method.toLowerCase()}`;
      const currentLoc = locationRef.current || { lat: 0, lng: 0 };

      // AUTOMATIZACIÓN DE FIRMA DEL DOCENTE EN SALIDA
      const recordData = {
        userId: user.id, 
        userName: user.name, 
        date: dateStr, 
        time: timeStr, 
        type: recordType,
        method: method, 
        shiftId: activeShift?.id, 
        shiftName: activeShift?.name,
        location: { lat: currentLoc.lat, lng: currentLoc.lng, address: `Punto GPS: ${currentLoc.lat.toFixed(6)}, ${currentLoc.lng.toFixed(6)}` },
        createdAt: serverTimestamp(),
        // Firma del docente si es salida
        docentSignature: recordType === 'exit' ? (user.signatureUrl || null) : null,
        //isVerified queda en false hasta que el coordinador valide en el reporte
        isVerified: false
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      setScanning(false);
      setManualSaving(false);
      setSuccess({ type: recordType, time: timeStr, shift: activeShift?.name });
      
      setTimeout(() => {
        setSuccess(null);
        isProcessing.current = false;
      }, 2000); 

    } catch (err: any) { 
      setScanning(false); setManualSaving(false); isProcessing.current = false; 
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500 text-center p-6">
        <div className={cn("w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-2xl", success.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
          <CheckCircle2 className={cn("w-16 h-16", success.type === 'entry' ? "text-green-500" : "text-blue-500")} />
        </div>
        <h2 className="text-4xl font-black text-gray-800">{success.type === 'entry' ? "¡Hola!" : "¡Buen Descanso!"}</h2>
        <div className="bg-white shadow-xl border border-gray-100 p-8 rounded-[2.5rem] mt-8 w-full max-w-sm">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Sello Digital Registrado</p>
          <p className="text-xl font-black text-primary mb-1">{success.shift}</p>
          <p className="text-sm font-bold text-gray-400">{success.time}</p>
        </div>
        <p className="mt-8 text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] animate-pulse">Siguiente en 2s...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white">
        <CardHeader className="bg-primary text-white text-center py-10">
          <CardTitle className="text-3xl font-black tracking-tight">Don Bosco Track</CardTitle>
          <p className="text-primary-foreground/80 text-[10px] font-black uppercase tracking-widest mt-1">Sello Biométrico Digital</p>
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          {timeError && (
            <Alert variant="destructive" className="rounded-2xl border-2">
              <XCircle className="h-5 w-5" />
              <AlertTitle className="font-black">Restricción de Jornada</AlertTitle>
              <AlertDescription className="text-xs font-bold">{timeError}</AlertDescription>
              <Button variant="outline" size="sm" className="mt-4 w-full h-10 font-black rounded-xl" onClick={() => setTimeError(null)}>Reintentar</Button>
            </Alert>
          )}

          {!timeError && (
            <div className="relative group">
               <div id={qrRegionId} className="w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-100 shadow-inner" />
               {!hasCameraPermission && hasCameraPermission !== null && (
                 <div className="absolute inset-0 bg-gray-50/90 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center gap-4">
                    <Camera className="w-12 h-12 text-muted-foreground opacity-20" />
                    <p className="text-sm font-black text-gray-400">Activa la cámara para marcar.</p>
                 </div>
               )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center gap-5">
              <div className={cn("p-4 rounded-2xl shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Localización de Alta Precisión</p>
                <p className="text-xs font-black text-gray-700">{location ? "Punto Georreferenciado" : "Buscando GPS..."}</p>
              </div>
              {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary ml-auto" />}
            </div>

            <div className="pt-4 border-t border-dashed">
               <Button 
                variant="outline" 
                onClick={() => registerAttendance('manual', 'Manual')}
                disabled={manualSaving || !!timeError}
                className="w-full h-16 rounded-[1.5rem] border-2 border-primary/20 bg-white text-primary font-black gap-3 hover:bg-primary hover:text-white transition-all shadow-lg"
               >
                 {manualSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <HandHelping className="w-6 h-6" />}
                 Marcaje Manual (Firma Automática)
               </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
