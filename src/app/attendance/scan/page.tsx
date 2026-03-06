
"use client"

import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, Loader2, Camera, User as UserIcon, Clock, ArrowLeft } from 'lucide-react';
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
  
  const qrRegionId = "public-qr-reader";
  const html5QrCode = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isProcessing = useRef(false);

  // Geolocalización continua para punto exacto
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setLocation(coords);
          locationRef.current = coords;
        },
        (err) => { 
          console.warn("GPS no disponible en terminal pública:", err.message);
        },
        { enableHighAccuracy: true }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Cámara optimizada para terminal (lens trasera)
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

  // Escáner con reinicio de 2 segundos
  useEffect(() => {
    if (hasCameraPermission && !lastScannedUser) {
      const startScanner = async () => {
        try {
          if (html5QrCode.current?.isScanning) return;
          html5QrCode.current = new Html5Qrcode(qrRegionId);
          await html5QrCode.current.start(
            { facingMode: "environment" }, 
            { fps: 15, qrbox: { width: 250, height: 250 } }, 
            (text) => handleScanSuccess(text), 
            () => {}
          );
        } catch (err) {}
      };
      startScanner();
      return () => { if (html5QrCode.current?.isScanning) html5QrCode.current.stop().catch(() => {}); };
    }
  }, [hasCameraPermission, lastScannedUser]);

  const handleScanSuccess = async (userId: string) => {
    if (isProcessing.current || !db) return;
    isProcessing.current = true;
    setScanning(true);
    
    try {
      const userRef = doc(db, 'userProfiles', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        toast({ variant: "destructive", title: "QR no reconocido" });
        setTimeout(() => { isProcessing.current = false; setScanning(false); }, 2000);
        return;
      }

      const userData = userSnap.data();
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

      let activeShift: Shift | null = null;
      if (userData.shiftIds?.length > 0) {
        const shiftsSnap = await getDocs(collection(db, 'shifts'));
        activeShift = shiftsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Shift))
          .find(s => userData.shiftIds.includes(s.id) && s.days?.includes(dayName)) || null;
      }

      const q = query(collection(db, 'userProfiles', userId, 'attendanceRecords'), orderBy('createdAt', 'desc'), limit(1));
      const querySnap = await getDocs(q);
      const recordType = !querySnap.empty && querySnap.docs[0].data().date === dateStr && querySnap.docs[0].data().type === 'entry' ? 'exit' : 'entry';

      const recordId = `${userId}_${now.getTime()}_terminal`;
      const currentLoc = locationRef.current || { lat: 0, lng: 0 };

      const recordData = {
        userId, 
        userName: userData.name, 
        date: dateStr, 
        time: timeStr, 
        type: recordType,
        method: 'QR Terminal', 
        shiftId: activeShift?.id || 'none', 
        shiftName: activeShift?.name || 'Fuera de Horario',
        location: { 
          lat: currentLoc.lat, 
          lng: currentLoc.lng,
          address: currentLoc.lat !== 0 ? `Punto: ${currentLoc.lat.toFixed(6)}, ${currentLoc.lng.toFixed(6)}` : 'Terminal sin GPS'
        }, 
        createdAt: serverTimestamp()
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', userId, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      setLastScannedUser({ name: userData.name, photo: userData.avatarUrl, time: timeStr, type: recordType, shift: activeShift?.name });
      
      // Reinicio de terminal en 2 segundos
      setTimeout(() => { 
        setLastScannedUser(null); 
        setScanning(false); 
        isProcessing.current = false; 
      }, 2000);
      
    } catch (err) { setScanning(false); isProcessing.current = false; }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full animate-in fade-in duration-700">
        <Link href="/" className="inline-flex items-center text-primary font-black mb-6 hover:gap-2 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Volver al Inicio
        </Link>
        <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white">
          <CardHeader className="bg-primary text-white text-center py-10">
            <CardTitle className="text-3xl font-black">Terminal de Marcaje</CardTitle>
            <CardDescription className="text-primary-foreground/90 font-bold mt-2 uppercase tracking-widest">Ciudad Don Bosco</CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            {lastScannedUser ? (
              <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in duration-300 text-center">
                <div className={cn("w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-xl mb-6", lastScannedUser.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
                   {lastScannedUser.photo ? <Image src={lastScannedUser.photo} alt={lastScannedUser.name} width={128} height={128} className="object-cover" unoptimized /> : <UserIcon className="w-16 h-16 text-gray-300" />}
                </div>
                <div>
                  <Badge className={cn("text-white font-black mb-2 px-4 py-1.5 rounded-xl uppercase", lastScannedUser.type === 'entry' ? "bg-green-500" : "bg-blue-500")}>
                    {lastScannedUser.type === 'entry' ? "INGRESO EXITOSO" : "SALIDA EXITOSA"}
                  </Badge>
                  <h3 className="text-3xl font-black text-gray-800">{lastScannedUser.name}</h3>
                  <div className="flex items-center justify-center gap-2 text-muted-foreground font-bold mt-2"><Clock className="w-4 h-4" /> {lastScannedUser.time} • {lastScannedUser.shift || 'Sin Jornada'}</div>
                </div>
              </div>
            ) : (
              <>
                <div id={qrRegionId} className="w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-200 shadow-inner" />
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
                  <div className={cn("p-3 rounded-2xl transition-colors shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}><MapPin className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Localización</p>
                    <p className="text-sm font-black text-gray-700">{location ? "Punto Georreferenciado" : "Capturando GPS..."}</p>
                  </div>
                  {scanning && <Loader2 className="w-6 h-6 animate-spin text-primary ml-auto" />}
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="bg-gray-50/50 p-8 border-t text-center justify-center">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-primary/40 animate-pulse">Sincronización en Tiempo Real</span>
          </CardFooter>
        </Card>
      </div>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
