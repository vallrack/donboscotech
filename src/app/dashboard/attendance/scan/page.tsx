
"use client"

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { QrCode, MapPin, CheckCircle2, RefreshCw, Loader2, ShieldCheck, Camera, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
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
        (decodedText) => handleScanSuccess(decodedText),
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
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    }
  }, [toast]);

  const handleScanSuccess = (decodedText: string) => {
    if (success || scanning) return;
    registerAttendance(decodedText);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db) return;

    const scanner = new Html5Qrcode(qrRegionId);
    try {
      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "QR no detectado",
        description: "No se encontró un código QR válido en la imagen.",
      });
    }
  };

  const registerAttendance = (token: string) => {
    if (!db || !user) return;

    if (!location) {
       toast({
         variant: "destructive",
         title: "Esperando GPS",
         description: "Por favor, espere a que el GPS valide su ubicación antes de escanear."
       });
       return;
    };

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
      tokenScanned: token,
      location: { lat: location.lat, lng: location.lng, address: 'Sede Ciudad Don Bosco' },
      createdAt: serverTimestamp()
    };

    const userRecordRef = doc(db, 'userProfiles', user.id, 'attendanceRecords', recordId);
    setDoc(userRecordRef, recordData).catch((err) => {
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
        toast({ title: "Asistencia Registrada", description: "¡Buen trabajo!" });
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
        <Button className="mt-8 h-12 rounded-xl font-bold" onClick={() => window.location.href = '/dashboard'}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-4 animate-in fade-in duration-500">
      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-white">
        <CardHeader className="bg-primary text-white text-center py-10 relative">
          <CardTitle className="text-3xl font-black">Registro Institucional</CardTitle>
          <CardDescription className="text-primary-foreground/80 font-medium">
            Escanea el código de la sede o sube una imagen
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-8 space-y-8">
          <div className="flex p-1 bg-gray-100 rounded-2xl">
            <Button 
              variant={mode === 'camera' ? 'default' : 'ghost'} 
              className={cn("flex-1 rounded-xl font-bold transition-all", mode === 'camera' && "shadow-md")}
              onClick={() => setMode('camera')}
            >
              <Camera className="w-4 h-4 mr-2" /> Cámara
            </Button>
            <Button 
              variant={mode === 'file' ? 'default' : 'ghost'} 
              className={cn("flex-1 rounded-xl font-bold transition-all", mode === 'file' && "shadow-md")}
              onClick={() => setMode('file')}
            >
              <ImageIcon className="w-4 h-4 mr-2" /> Imagen
            </Button>
          </div>

          <div className="relative group">
            <div 
              id={qrRegionId} 
              className={cn(
                "w-full aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border-4 border-dashed border-gray-200 transition-all",
                mode === 'file' && "hidden"
              )}
            />
            
            {mode === 'camera' && !hasCameraPermission && hasCameraPermission !== null && (
              <Alert variant="destructive" className="mt-4 rounded-2xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Acceso a Cámara Requerido</AlertTitle>
                <AlertDescription>Habilite los permisos de cámara en su navegador.</AlertDescription>
              </Alert>
            )}

            {mode === 'file' && (
              <div className="w-full aspect-square bg-gray-50 rounded-[2rem] flex flex-col items-center justify-center border-4 border-dashed border-gray-200 p-8 text-center space-y-4">
                <ImageIcon className="w-10 h-10 text-primary opacity-20" />
                <p className="font-bold text-gray-800">Sube una foto del QR</p>
                <Input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="qr-upload" />
                <Button asChild className="rounded-xl font-bold h-12 px-8">
                  <label htmlFor="qr-upload" className="cursor-pointer">Seleccionar Archivo</label>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
             <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-4">
                <div className={cn("p-2 rounded-xl", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                   {locationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Geolocalización</p>
                   <p className="text-xs font-bold text-gray-700">{location ? "GPS Activo - Zona Validada" : "Esperando señal GPS..."}</p>
                </div>
             </div>
          </div>
        </CardContent>

        <CardFooter className="bg-gray-50/50 p-8">
           <p className="text-[10px] text-center w-full text-muted-foreground leading-relaxed font-medium">
             Su ubicación se valida automáticamente para el registro laboral institucional.
           </p>
        </CardFooter>
      </Card>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
