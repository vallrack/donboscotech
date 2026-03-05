
"use client"

import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, Loader2, Camera, Image as ImageIcon, User as UserIcon, Clock, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Shift } from '@/lib/types';

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
          description: "La terminal institucional requiere acceso al GPS.",
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
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) {
        setHasCameraPermission(false);
      }
    };
    if (mode === 'camera') getCameraPermission();
  }, [mode]);

  useEffect(() => {
    if (mode === 'camera' && hasCameraPermission && !lastScannedUser) {
      const startScanner = async () => {
        try {
          html5QrCode.current = new Html5Qrcode(qrRegionId);
          const config = { fps: 15, qrbox: { width: 250, height: 250 } };
          await html5QrCode.current.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => handleScanSuccess(decodedText), 
            () => {}
          );
        } catch (err) {
          console.error("Scanner start error:", err);
        }
      };

      startScanner();
      
      return () => { 
        if (html5QrCode.current?.isScanning) {
          html5QrCode.current.stop().catch(() => {}); 
        }
      };
    }
  }, [mode, hasCameraPermission, lastScannedUser]);

  const handleScanSuccess = async (userId: string) => {
    if (isProcessing.current || !db) return;
    if (!locationRef.current) {
       toast({ variant: "destructive", title: "GPS Requerido", description: "Validando ubicación..." });
       return;
    }

    isProcessing.current = true;
    setScanning(true);
    
    try {
      const userRef = doc(db, 'userProfiles', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        toast({ variant: "destructive", title: "No Encontrado", description: "QR no registrado." });
        setTimeout(() => { isProcessing.current = false; setScanning(false); }, 2000);
        return;
      }

      const userData = userSnap.data();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

      let activeShift: Shift | null = null;
      if (userData.shiftIds && userData.shiftIds.length > 0) {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        const userShifts = shiftsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Shift))
          .filter(s => userData.shiftIds.includes(s.id));
        activeShift = userShifts.find(s => s.days?.includes(dayName)) || null;
      }

      const recordsCol = collection(db, 'userProfiles', userId, 'attendanceRecords');
      const q = query(recordsCol, orderBy('createdAt', 'desc'), limit(1));
      let recordType: 'entry' | 'exit' = 'entry';
      
      try {
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const lastRecord = querySnap.docs[0].data();
          if (lastRecord.date === dateStr) recordType = lastRecord.type === 'entry' ? 'exit' : 'entry';
        }
      } catch (e) {}

      const recordId = `${userId}_${now.getTime()}_terminal`;
      const recordData = {
        userId: userId,
        userName: userData.name,
        date: dateStr,
        time: timeStr,
        type: recordType,
        method: 'QR Terminal',
        shiftId: activeShift?.id || 'none',
        shiftName: activeShift?.name || 'Fuera de Jornada',
        location: locationRef.current,
        createdAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', userId, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      setLastScannedUser({ 
        name: userData.name, 
        photo: userData.avatarUrl, 
        time: timeStr, 
        type: recordType, 
        shift: activeShift?.name 
      });

      toast({ title: recordType === 'entry' ? "¡Bienvenido!" : "¡Hasta pronto!" });

      // Reinicio automático después de 2 segundos para permitir escaneo continuo
      setTimeout(() => { 
        setLastScannedUser(null); 
        setScanning(false); 
        isProcessing.current = false; 
      }, 2000);
      
    } catch (err: any) {
      setScanning(false); 
      isProcessing.current = false;
      toast({ variant: "destructive", title: "Error", description: "No se pudo procesar." });
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
      toast({ variant: "destructive", title: "Error", description: "QR no detectado." });
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
            <CardTitle className="text-3xl font-black">Terminal de Asistencia</CardTitle>
            <CardDescription className="text-primary-foreground/90 font-bold text-base mt-2">CIUDAD DON BOSCO</CardDescription>
          </CardHeader>
          
          <CardContent className="p-10 space-y-8">
            {lastScannedUser ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in duration-300 text-center">
                <div className={cn("w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-xl mb-6 relative", lastScannedUser.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
                   {lastScannedUser.photo ? (
                     <Image src={lastScannedUser.photo} alt={lastScannedUser.name} width={128} height={128} className="object-cover" unoptimized />
                   ) : (
                     <UserIcon className={cn("w-16 h-16", lastScannedUser.type === 'entry' ? "text-green-600" : "text-blue-600")} />
                   )}
                </div>
                <div>
                  <Badge className={cn("text-white font-black mb-2 px-4 py-1.5 rounded-xl uppercase tracking-widest", lastScannedUser.type === 'entry' ? "bg-green-500" : "bg-blue-500")}>
                    {lastScannedUser.type === 'entry' ? "INGRESO EXITOSO" : "SALIDA EXITOSA"}
                  </Badge>
                  <h3 className="text-3xl font-black text-gray-800">{lastScannedUser.name}</h3>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground font-bold mt-2">
                    <Clock className="w-4 h-4" /> {lastScannedUser.time} • {lastScannedUser.shift || 'Sin Jornada'}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex p-1.5 bg-gray-100 rounded-2xl">
                  <Button variant={mode === 'camera' ? 'default' : 'ghost'} className={cn("flex-1 rounded-xl font-black transition-all h-12", mode === 'camera' && "shadow-lg")} onClick={() => setMode('camera')}>
                    <Camera className="w-5 h-5 mr-2" /> CÁMARA
                  </Button>
                  <Button variant={mode === 'file' ? 'default' : 'ghost'} className={cn("flex-1 rounded-xl font-black transition-all h-12", mode === 'file' && "shadow-lg")} onClick={() => setMode('file')}>
                    <ImageIcon className="w-5 h-5 mr-2" /> ARCHIVO
                  </Button>
                </div>
                <div id={qrRegionId} className={cn("w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-200 transition-all shadow-inner", mode === 'file' && "hidden")} />
                {mode === 'file' && (
                  <div className="w-full aspect-square bg-gray-50 rounded-[2.5rem] flex flex-col items-center justify-center border-4 border-dashed border-gray-200 p-8 text-center space-y-6">
                    <QrCode className="w-16 h-16 text-primary opacity-20" />
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" id="public-qr-upload" />
                    <Button asChild className="rounded-2xl font-black h-14 px-10 shadow-lg"><label htmlFor="public-qr-upload" className="cursor-pointer">SELECCIONAR CARNET</label></Button>
                  </div>
                )}
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
                  <div className={cn("p-3 rounded-2xl", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}><MapPin className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">LOCALIZACIÓN</p>
                    <p className="text-sm font-black text-gray-700">{location ? "ZONA AUTORIZADA" : "VALIDANDO GPS..."}</p>
                  </div>
                  {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary ml-auto" />}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-gray-50/50 p-10 flex flex-col gap-4 border-t text-center">
             <span className="text-xs font-black uppercase tracking-[0.2em] text-primary/40">Sincronización Inteligente de Jornada</span>
          </CardFooter>
        </Card>
      </div>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
