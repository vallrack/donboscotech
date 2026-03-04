
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
import { QrCode, MapPin, CheckCircle2, Loader2, ShieldCheck, Camera, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";

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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        setHasCameraPermission(false);
      }
    };

    if (mode === 'camera') {
      getCameraPermission();
    }
  }, [mode]);

  useEffect(() => {
    if (mode === 'camera' && hasCameraPermission) {
      html5QrCode.current = new Html5Qrcode(qrRegionId);
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      html5QrCode.current.start(
        { facingMode: "environment" }, 
        config,
        (decodedText) => registerAttendance(decodedText),
        () => {}
      ).catch(() => {});

      return () => {
        if (html5QrCode.current?.isScanning) {
          html5QrCode.current.stop().catch(() => {});
        }
      };
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
          toast({ 
            title: "GPS Requerido", 
            description: "Debe habilitar el GPS para validar su presencia en la sede.",
            variant: "destructive" 
          });
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [toast]);

  const registerAttendance = async (token: string) => {
    if (!db || !user || success || scanning) return;

    if (!locationRef.current) {
       toast({
         variant: "destructive",
         title: "Esperando GPS",
         description: "Por favor, espere a que el GPS valide su ubicación antes de escanear."
       });
       return;
    };

    setScanning(true);
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    try {
      // LÓGICA DE DETECCIÓN INTELIGENTE (ENTRADA/SALIDA)
      // Se utiliza una consulta simple en la subcolección del usuario
      const q = query(
        collection(db, 'userProfiles', user.id, 'attendanceRecords'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnap = await getDocs(q);
      let recordType: 'entry' | 'exit' = 'entry';
      
      if (!querySnap.empty) {
        const lastRecord = querySnap.docs[0].data();
        if (lastRecord.date === dateStr) {
          recordType = lastRecord.type === 'entry' ? 'exit' : 'entry';
        }
      }

      const recordId = `${user.id}_${now.getTime()}`;
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const recordData = {
        userId: user.id,
        userName: user.name,
        date: dateStr,
        time: timeStr,
        type: recordType,
        method: 'QR',
        tokenScanned: token,
        location: { lat: locationRef.current.lat, lng: locationRef.current.lng, address: 'Sede Ciudad Don Bosco' },
        createdAt: serverTimestamp()
      };

      const userRecordRef = doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId);
      const globalRecordRef = doc(db, 'globalAttendanceRecords', recordId);

      await Promise.all([
        setDoc(userRecordRef, recordData),
        setDoc(globalRecordRef, recordData)
      ]);

      setScanning(false);
      setSuccess({ type: recordType, time: timeStr });
      toast({ 
        title: recordType === 'entry' ? "Ingreso Registrado" : "Salida Registrada", 
        description: "¡Buen trabajo!" 
      });

    } catch (err: any) {
      setScanning(false);
      console.error("Error de registro:", err);
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: "No se pudo sincronizar la asistencia."
      });
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
      toast({
        variant: "destructive",
        title: "QR no detectado",
        description: "No se encontró un código QR válido en la imagen.",
      });
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in zoom-in duration-500">
        <div className={cn(
          "w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-lg",
          success.type === 'entry' ? "bg-green-100" : "bg-blue-100"
        )}>
          <CheckCircle2 className={cn("w-16 h-16", success.type === 'entry' ? "text-green-500" : "text-blue-500")} />
        </div>
        <h2 className="text-3xl font-black">
          {success.type === 'entry' ? "¡Ingreso Registrado!" : "¡Salida Registrada!"}
        </h2>
        <p className="text-muted-foreground mt-2 font-bold">
          Sincronizado correctamente a las {success.time}.
        </p>
        <Button className="mt-8 h-12 rounded-xl font-bold px-8 shadow-lg" onClick={() => window.location.href = '/dashboard'}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-primary text-white text-center py-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardTitle className="text-3xl font-black">Registro Institucional</CardTitle>
          <CardDescription className="text-primary-foreground/80 font-bold mt-2">
            Escanea el código de la sede o sube una imagen
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          <div className="flex p-1.5 bg-gray-100 rounded-2xl">
            <Button 
              variant={mode === 'camera' ? 'default' : 'ghost'} 
              className={cn("flex-1 rounded-xl font-black transition-all h-11", mode === 'camera' && "shadow-md")}
              onClick={() => setMode('camera')}
            >
              <Camera className="w-4 h-4 mr-2" /> Cámara
            </Button>
            <Button 
              variant={mode === 'file' ? 'default' : 'ghost'} 
              className={cn("flex-1 rounded-xl font-black transition-all h-11", mode === 'file' && "shadow-md")}
              onClick={() => setMode('file')}
            >
              <ImageIcon className="w-4 h-4 mr-2" /> Imagen
            </Button>
          </div>

          <div className="relative group">
            <div 
              id={qrRegionId} 
              className={cn(
                "w-full aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border-4 border-dashed border-gray-200 transition-all shadow-inner",
                mode === 'file' && "hidden"
              )}
            />
            
            {mode === 'camera' && !hasCameraPermission && hasCameraPermission !== null && (
              <Alert variant="destructive" className="mt-4 rounded-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-black">ACCESO A CÁMARA REQUERIDO</AlertTitle>
                <AlertDescription className="font-bold">Habilite los permisos de cámara en su navegador para registrarse.</AlertDescription>
              </Alert>
            )}

            {mode === 'file' && (
              <div className="w-full aspect-square bg-gray-50 rounded-[2rem] flex flex-col items-center justify-center border-4 border-dashed border-gray-200 p-8 text-center space-y-4 shadow-inner">
                <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center text-primary/30">
                  <ImageIcon className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-black text-gray-800">Sube una foto del QR</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Formatos: JPG, PNG</p>
                </div>
                <Input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="qr-upload" />
                <Button asChild className="rounded-xl font-black h-12 px-10 shadow-lg shadow-primary/10">
                  <label htmlFor="qr-upload" className="cursor-pointer">SELECCIONAR ARCHIVO</label>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
             <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
                <div className={cn("p-3 rounded-2xl shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                   {locationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Geolocalización</p>
                   <p className="text-xs font-black text-gray-700">{location ? "GPS Activo - Zona Validada" : "Esperando señal GPS..."}</p>
                </div>
                {scanning && <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />}
             </div>
          </div>
        </CardContent>

        <CardFooter className="bg-gray-50/50 p-8 border-t">
           <div className="flex items-center justify-center gap-3 text-primary/40 mb-2 w-full">
             <ShieldCheck className="w-4 h-4" />
             <span className="text-[9px] font-black uppercase tracking-widest">Protocolo de Seguridad Don Bosco</span>
           </div>
           <p className="text-[10px] text-center w-full text-muted-foreground leading-relaxed font-bold opacity-60">
             Su ubicación se valida automáticamente para el registro laboral institucional. Todos los datos están cifrados.
           </p>
        </CardFooter>
      </Card>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
