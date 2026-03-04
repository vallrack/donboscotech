
"use client"

import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { QrCode, MapPin, Loader2, Camera, Image as ImageIcon, AlertCircle, ArrowLeft, User as UserIcon, ShieldCheck, LogOut, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

export default function PublicAttendanceScanner() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScannedUser, setLastScannedUser] = useState<any>(null);
  const [mode, setMode] = useState<'camera' | 'file'>('camera');
  
  const qrRegionId = "public-qr-reader";
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        (err) => toast({ 
          title: "GPS Requerido", 
          description: "La terminal institucional requiere acceso al GPS para validar la ubicación de la sede.",
          variant: "destructive" 
        }),
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [toast]);

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
      const config = { fps: 15, qrbox: { width: 250, height: 250 } };
      
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

  const handleScanSuccess = async (userId: string) => {
    if (isProcessing.current || !db) return;
    
    if (!locationRef.current) {
       toast({
         variant: "destructive",
         title: "GPS Requerido",
         description: "Esperando validación de ubicación de la sede."
       });
       return;
    }

    isProcessing.current = true;
    setScanning(true);
    
    try {
      const userRef = doc(db, 'userProfiles', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        toast({
          variant: "destructive",
          title: "Carnet no válido",
          description: "El código escaneado no pertenece a un docente registrado."
        });
        setTimeout(() => {
          isProcessing.current = false;
          setScanning(false);
        }, 3000);
        return;
      }

      const userData = userSnap.data();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // LÓGICA DE DETECCIÓN INTELIGENTE (ENTRADA/SALIDA)
      // Se utiliza una consulta simple por orden de creación para evitar la necesidad de índices compuestos
      const q = query(
        collection(db, 'userProfiles', userId, 'attendanceRecords'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      
      const querySnap = await getDocs(q);
      let recordType: 'entry' | 'exit' = 'entry';
      
      if (!querySnap.empty) {
        const lastRecord = querySnap.docs[0].data();
        // Si el último registro fue hoy, alternamos. Si fue otro día, empezamos con entrada.
        if (lastRecord.date === dateStr) {
          recordType = lastRecord.type === 'entry' ? 'exit' : 'entry';
        }
      }

      const recordId = `${userId}_${now.getTime()}_public`;
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      
      const recordData = {
        userId: userId,
        userName: userData.name,
        date: dateStr,
        time: timeStr,
        type: recordType,
        method: 'QR Terminal',
        location: locationRef.current,
        createdAt: serverTimestamp()
      };

      const userRecordRef = doc(db, 'userProfiles', userId, 'attendanceRecords', recordId);
      const globalRecordRef = doc(db, 'globalAttendanceRecords', recordId);
      
      await Promise.all([
        setDoc(userRecordRef, recordData),
        setDoc(globalRecordRef, recordData)
      ]);

      setLastScannedUser({ 
        name: userData.name, 
        photo: userData.avatarUrl, 
        time: timeStr, 
        type: recordType 
      });
      
      toast({
        title: recordType === 'entry' ? "¡Ingreso Registrado!" : "¡Salida Registrada!",
        description: `Buen turno, ${userData.name.split(' ')[0]}.`
      });

      setTimeout(() => {
        setLastScannedUser(null);
        setScanning(false);
        isProcessing.current = false;
      }, 5000);

    } catch (err: any) {
      setScanning(false);
      isProcessing.current = false;
      
      console.error("Error detallado de escaneo:", err);

      if (err.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `userProfiles/${userId}/attendanceRecords`,
          operation: 'write'
        }));
      } else {
        toast({
          variant: "destructive",
          title: "Fallo en la terminal",
          description: "No se pudo sincronizar el registro. Verifique su conexión."
        });
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !db || isProcessing.current) return;

    const scanner = new Html5Qrcode(qrRegionId);
    try {
      const decodedText = await scanner.scanFile(file, true);
      handleScanSuccess(decodedText);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "QR no detectado",
        description: "Asegúrese de que el carnet esté bien iluminado y sea legible."
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full animate-in fade-in duration-700">
        <Link href="/" className="inline-flex items-center text-primary font-black mb-6 hover:gap-2 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Volver al Inicio
        </Link>

        <Card className="border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] overflow-hidden rounded-[3rem] bg-white">
          <CardHeader className="bg-primary text-white text-center py-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <CardTitle className="text-3xl font-black">Terminal de Asistencia</CardTitle>
            <CardDescription className="text-primary-foreground/90 font-bold text-base mt-2">
              CIUDAD DON BOSCO - SEDE OFICIAL
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-10 space-y-8">
            {lastScannedUser ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in duration-300 text-center">
                <div className={cn(
                  "w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-xl mb-6 relative",
                  lastScannedUser.type === 'entry' ? "bg-green-100" : "bg-blue-100"
                )}>
                   {lastScannedUser.photo ? (
                     <Image src={lastScannedUser.photo} alt={lastScannedUser.name} width={128} height={128} className="object-cover" unoptimized />
                   ) : (
                     <UserIcon className={cn("w-16 h-16", lastScannedUser.type === 'entry' ? "text-green-600" : "text-blue-600")} />
                   )}
                   <div className={cn(
                     "absolute bottom-2 right-2 p-1.5 rounded-lg shadow-lg",
                     lastScannedUser.type === 'entry' ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                   )}>
                     {lastScannedUser.type === 'entry' ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
                   </div>
                </div>
                <div>
                  <Badge className={cn(
                    "text-white font-black mb-2 px-4 py-1.5 rounded-xl uppercase tracking-widest",
                    lastScannedUser.type === 'entry' ? "bg-green-500" : "bg-blue-500"
                  )}>
                    {lastScannedUser.type === 'entry' ? "INGRESO EXITOSO" : "SALIDA EXITOSA"}
                  </Badge>
                  <h3 className="text-3xl font-black text-gray-800">{lastScannedUser.name}</h3>
                  <p className="text-muted-foreground font-bold mt-1 flex items-center justify-center gap-2">
                    Registrado a las {lastScannedUser.time}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex p-1.5 bg-gray-100 rounded-2xl">
                  <Button 
                    variant={mode === 'camera' ? 'default' : 'ghost'} 
                    className={cn("flex-1 rounded-xl font-black transition-all h-12", mode === 'camera' && "shadow-lg")}
                    onClick={() => setMode('camera')}
                  >
                    <Camera className="w-5 h-5 mr-2" /> ESCANEAR CÁMARA
                  </Button>
                  <Button 
                    variant={mode === 'file' ? 'default' : 'ghost'} 
                    className={cn("flex-1 rounded-xl font-black transition-all h-12", mode === 'file' && "shadow-lg")}
                    onClick={() => setMode('file')}
                  >
                    <ImageIcon className="w-5 h-5 mr-2" /> SUBIR ARCHIVO
                  </Button>
                </div>

                <div className="relative group">
                  <div 
                    id={qrRegionId} 
                    className={cn(
                      "w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-200 transition-all shadow-inner",
                      mode === 'file' && "hidden"
                    )}
                  />
                  
                  {mode === 'camera' && !hasCameraPermission && hasCameraPermission !== null && (
                    <Alert variant="destructive" className="mt-4 rounded-3xl border-2">
                      <AlertCircle className="h-5 w-5" />
                      <AlertTitle className="font-black">ACCESO A CÁMARA DENEGADO</AlertTitle>
                      <AlertDescription className="font-bold">
                        Habilite los permisos de cámara en los ajustes del navegador para usar la terminal.
                      </AlertDescription>
                    </Alert>
                  )}

                  {mode === 'file' && (
                    <div className="w-full aspect-square bg-gray-50 rounded-[2.5rem] flex flex-col items-center justify-center border-4 border-dashed border-gray-200 p-8 text-center space-y-6 shadow-inner">
                      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                         <QrCode className="w-12 h-12" />
                      </div>
                      <div className="space-y-2">
                        <p className="font-black text-xl text-gray-800">Sube tu carnet digital</p>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">CAPTURA DE PANTALLA O FOTO</p>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        className="hidden" 
                        id="public-qr-upload"
                      />
                      <Button asChild className="rounded-2xl font-black h-14 px-10 shadow-lg shadow-primary/20">
                        <label htmlFor="public-qr-upload" className="cursor-pointer">SELECCIONAR IMAGEN</label>
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
                    <div className={cn("p-3 rounded-2xl shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}>
                      <MapPin className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">VALIDACIÓN DE SEDE</p>
                      <p className="text-sm font-black text-gray-700">{location ? "ZONA AUTORIZADA DETECTADA" : "BUSCANDO UBICACIÓN..."}</p>
                    </div>
                    {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary ml-auto" />}
                  </div>
                </div>
              </>
            )}
          </CardContent>

          <CardFooter className="bg-gray-50/50 p-10 flex flex-col gap-4 border-t">
             <div className="flex items-center justify-center gap-3 text-primary mb-2">
               <ShieldCheck className="w-5 h-5" />
               <span className="text-xs font-black uppercase tracking-[0.2em]">Don Bosco Security Protocol v4.0</span>
             </div>
             <p className="text-[10px] text-center w-full text-muted-foreground leading-relaxed font-bold uppercase tracking-tighter opacity-70">
               Terminal de uso exclusivo para personal de Ciudad Don Bosco. Todos los registros son monitoreados por la coordinación administrativa.
             </p>
          </CardFooter>
        </Card>
      </div>
      
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
