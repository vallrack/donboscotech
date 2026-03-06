
"use client"

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, MapPin, Camera, QrCode, AlertCircle, HandHelping } from 'lucide-react';
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
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [manualSaving, setManualSaving] = useState(false);
  
  const qrRegionId = "qr-reader";
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isProcessing = useRef(false);

  // 1. Geolocalización en tiempo real
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        (err) => { 
          toast({ title: "GPS Requerido", description: "Por favor activa tu ubicación.", variant: "destructive" }); 
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [toast]);

  // 2. Permisos y pre-carga de cámara para móviles
  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" } 
        });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) { 
        setHasCameraPermission(false); 
      }
    };
    getCameraPermission();
  }, []);

  // 3. Inicialización del Escáner QR
  useEffect(() => {
    if (hasCameraPermission && !success && !isProcessing.current) {
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
        } catch (err) {
          console.error("Scanner error:", err);
        }
      };
      startScanner();
      return () => { 
        if (html5QrCode.current?.isScanning) {
          html5QrCode.current.stop().catch(() => {});
        }
      };
    }
  }, [hasCameraPermission, success]);

  const registerAttendance = async (token: string, method: 'QR' | 'Manual' = 'QR') => {
    if (!db || !user || success || isProcessing.current) return;
    if (!locationRef.current) { 
      toast({ variant: "destructive", title: "Esperando GPS", description: "Ubícate en una zona con señal." }); 
      return; 
    };

    isProcessing.current = true;
    if (method === 'Manual') setManualSaving(true);
    else setScanning(true);

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];
    
    try {
      // Determinar Jornada Activa
      let activeShift: Shift | null = null;
      if (user.shiftIds && user.shiftIds.length > 0) {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        activeShift = shiftsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Shift))
          .find(s => user.shiftIds?.includes(s.id) && s.days?.includes(dayName)) || null;
      }

      // Determinar si es Entrada o Salida
      const q = query(collection(db, 'userProfiles', user.id, 'attendanceRecords'), orderBy('createdAt', 'desc'), limit(1));
      const querySnap = await getDocs(q);
      const recordType = !querySnap.empty && querySnap.docs[0].data().date === dateStr && querySnap.docs[0].data().type === 'entry' ? 'exit' : 'entry';

      const recordId = `${user.id}_${now.getTime()}_${method.toLowerCase()}`;
      const recordData = {
        userId: user.id, 
        userName: user.name, 
        date: dateStr, 
        time: timeStr, 
        type: recordType,
        method: method, 
        shiftId: activeShift?.id || 'none', 
        shiftName: activeShift?.name || 'Fuera de Horario',
        location: { 
          lat: locationRef.current.lat, 
          lng: locationRef.current.lng, 
          address: `Lat: ${locationRef.current.lat.toFixed(4)}, Lng: ${locationRef.current.lng.toFixed(4)}` 
        },
        createdAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      setScanning(false);
      setManualSaving(false);
      setSuccess({ type: recordType, time: timeStr, shift: activeShift?.name });
      
      // REINICIO AUTOMÁTICO EN 2 SEGUNDOS
      setTimeout(() => {
        setSuccess(null);
        isProcessing.current = false;
      }, 2000);

    } catch (err: any) { 
      setScanning(false); 
      setManualSaving(false);
      isProcessing.current = false; 
      toast({ variant: "destructive", title: "Error al registrar", description: err.message });
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500 text-center p-6">
        <div className={cn("w-28 h-28 rounded-full flex items-center justify-center mb-8 shadow-2xl", success.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
          <CheckCircle2 className={cn("w-16 h-16", success.type === 'entry' ? "text-green-500" : "text-blue-500")} />
        </div>
        <h2 className="text-4xl font-black text-gray-800">{success.type === 'entry' ? "¡Bienvenido!" : "¡Buen Turno!"}</h2>
        <div className="bg-white shadow-xl border border-gray-100 p-8 rounded-[2.5rem] mt-8 w-full max-w-sm">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2">Jornada Detectada</p>
          <p className="text-xl font-black text-primary mb-1">{success.shift || 'Fuera de Horario'}</p>
          <p className="text-sm font-bold text-gray-400">Registrado: {success.time}</p>
        </div>
        <p className="mt-8 text-xs font-black text-primary/40 uppercase tracking-[0.3em] animate-pulse">Siguiente registro en 2s...</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 space-y-6 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white">
        <CardHeader className="bg-primary text-white text-center py-12">
          <CardTitle className="text-3xl font-black tracking-tight">Registro de Asistencia</CardTitle>
          <p className="text-primary-foreground/80 text-xs font-bold uppercase tracking-widest mt-2">Ciudad Don Bosco</p>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          {/* Contenedor del Lector QR */}
          <div className="relative group">
             <div id={qrRegionId} className="w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-100 shadow-inner" />
             {!hasCameraPermission && hasCameraPermission !== null && (
               <div className="absolute inset-0 bg-gray-50/90 rounded-[2.5rem] flex flex-col items-center justify-center p-8 text-center gap-4">
                  <Camera className="w-12 h-12 text-muted-foreground opacity-20" />
                  <p className="text-sm font-black text-gray-400 leading-tight">La cámara no está disponible en este dispositivo.</p>
               </div>
             )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Status de GPS */}
            <div className="p-5 bg-gray-50 rounded-[2rem] border border-gray-100 flex items-center gap-5">
              <div className={cn("p-4 rounded-2xl shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Geolocalización</p>
                <p className="text-xs font-black text-gray-700">{location ? "Zona Institucional Validada" : "Ubicando GPS..."}</p>
              </div>
              {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary ml-auto" />}
            </div>

            {/* Marcaje Manual Alternativo */}
            <div className="pt-4 border-t border-dashed">
               <Button 
                variant="outline" 
                onClick={() => registerAttendance('manual', 'Manual')}
                disabled={manualSaving || !location}
                className="w-full h-16 rounded-[1.5rem] border-2 border-primary/20 bg-white text-primary font-black gap-3 hover:bg-primary hover:text-white transition-all shadow-lg"
               >
                 {manualSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <HandHelping className="w-6 h-6" />}
                 Marcaje Manual de Emergencia
               </Button>
               <p className="text-[9px] text-center mt-3 text-muted-foreground font-bold italic">
                 Usa esta opción si tienes problemas persistentes con el escáner QR.
               </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Video oculto para forzar inicialización de cámara en móviles */}
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      <div className="bg-yellow-50 border border-yellow-100 rounded-[2rem] p-6 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-yellow-800 uppercase mb-1">Nota de Seguridad</p>
          <p className="text-[10px] text-yellow-700/80 font-bold leading-relaxed">
            Tu ubicación geográfica se registra en cada marcaje para auditoría institucional. Asegúrate de tener el GPS activo.
          </p>
        </div>
      </div>
    </div>
  );
}
