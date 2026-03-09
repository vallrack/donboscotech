"use client"

import { useState, useEffect, useRef } from 'react';
import { useFirestore } from '@/firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, Loader2, Camera, User as UserIcon, XCircle, ArrowLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Html5Qrcode } from "html5-qrcode";
import Link from 'next/link';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Shift } from '@/lib/types';
import { notifyAttendance } from '@/ai/flows/attendance-notification-flow';

export default function PublicAttendanceScanner() {
  const db = useFirestore();
  const { toast } = useToast();
  
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const locationRef = useRef<{ lat: number, lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [lastScannedUser, setLastScannedUser] = useState<any>(null);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  
  const qrRegionId = "public-qr-reader";
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
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (error) { setHasCameraPermission(false); }
    };
    getCameraPermission();
  }, []);

  useEffect(() => {
    if (hasCameraPermission && !lastScannedUser && !errorInfo) {
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
  }, [hasCameraPermission, lastScannedUser, errorInfo]);

  const handleScanSuccess = async (userId: string) => {
    if (isProcessing.current || !db) return;
    isProcessing.current = true;
    setScanning(true);
    setErrorInfo(null);
    
    try {
      const userRef = doc(db, 'userProfiles', userId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        toast({ variant: "destructive", title: "Acceso Inválido", description: "El carnet escaneado no está registrado." });
        isProcessing.current = false; setScanning(false); return;
      }

      const userData = userSnap.data();
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const [currH, currM] = timeStr.split(':').map(Number);
      const currTotal = currH * 60 + currM;
      const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

      const shiftsSnap = await getDocs(collection(db, 'shifts'));
      const todayShifts = shiftsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as Shift))
        .filter(s => userData.shiftIds?.includes(s.id) && s.days?.includes(dayName));

      let activeShift: Shift | null = null;
      let isWithinTime = false;

      // REGLA: Marcaje habilitado desde 10 minutos antes del inicio oficial
      for (const s of todayShifts) {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        const startT = sh * 60 + sm;
        const endT = eh * 60 + em;
        
        if (currTotal >= (startT - 10) && currTotal <= (endT + 60)) {
          activeShift = s;
          isWithinTime = true;
          break;
        }
      }

      if (!isWithinTime) {
        setErrorInfo(todayShifts.length > 0 
          ? `Acceso Denegado: Tu jornada inicia a las ${todayShifts[0].startTime}. Solo puedes marcar desde 10 min antes.`
          : "No tienes jornada asignada para hoy en el sistema."
        );
        setScanning(false); isProcessing.current = false; return;
      }

      const dateStr = now.toISOString().split('T')[0];
      const q = query(collection(db, 'userProfiles', userId, 'attendanceRecords'), orderBy('createdAt', 'desc'), limit(1));
      const querySnap = await getDocs(q);
      const lastRec = !querySnap.empty ? querySnap.docs[0].data() : null;
      const recordType = lastRec && lastRec.date === dateStr && lastRec.type === 'entry' ? 'exit' : 'entry';

      if (recordType === 'exit' && activeShift) {
        const [eh, em] = activeShift.endTime.split(':').map(Number);
        if (currTotal < (eh * 60 + em)) {
          setErrorInfo(`Salida Anticipada: Debes cumplir tu jornada hasta las ${activeShift.endTime}.`);
          setScanning(false); isProcessing.current = false; return;
        }
      }

      const recordId = `${userId}_${now.getTime()}_terminal`;
      const currentLoc = locationRef.current || { lat: 0, lng: 0 };

      const recordData = {
        userId, 
        userName: userData.name, 
        date: dateStr, 
        time: timeStr, 
        type: recordType,
        method: 'QR Terminal', 
        shiftId: activeShift?.id, 
        shiftName: activeShift?.name,
        location: { lat: currentLoc.lat, lng: currentLoc.lng, address: `Terminal GPS: ${currentLoc.lat.toFixed(6)}, ${currentLoc.lng.toFixed(6)}` },
        createdAt: serverTimestamp(),
        docentSignature: recordType === 'exit' ? (userData.signatureUrl || null) : null,
        isVerified: false
      };

      await Promise.all([
        setDoc(doc(db, 'userProfiles', userId, 'attendanceRecords', recordId), recordData),
        setDoc(doc(db, 'globalAttendanceRecords', recordId), recordData)
      ]);

      // Notificación de Alerta Genkit
      notifyAttendance({
        userName: userData.name,
        userEmail: userData.email,
        type: recordType,
        time: timeStr,
        date: dateStr,
        method: 'QR Terminal',
        location: recordData.location.address
      }).catch(e => console.error("Error notificar terminal", e));

      setLastScannedUser({ name: userData.name, photo: userData.avatarUrl, time: timeStr, type: recordType, shift: activeShift?.name });
      setTimeout(() => { setLastScannedUser(null); setScanning(false); isProcessing.current = false; }, 2000); 
      
    } catch (err) { setScanning(false); isProcessing.current = false; }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-xl w-full animate-in fade-in duration-700">
        <Link href="/" className="inline-flex items-center text-primary font-black mb-6 hover:gap-2 transition-all">
          <ArrowLeft className="w-5 h-5 mr-2" /> Salir de Terminal
        </Link>
        <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-white">
          <CardHeader className="bg-primary text-white text-center py-10">
            <CardTitle className="text-3xl font-black">Terminal Ciudad Don Bosco</CardTitle>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mt-1">Sello de Seguridad Institucional</p>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            {errorInfo ? (
              <div className="animate-in zoom-in duration-300 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto"><XCircle className="w-12 h-12 text-red-500" /></div>
                <div>
                  <h3 className="text-2xl font-black text-red-600">Marcaje Denegado</h3>
                  <p className="text-muted-foreground font-bold mt-2 leading-relaxed">{errorInfo}</p>
                </div>
                <Button className="w-full h-14 rounded-2xl font-black shadow-lg" onClick={() => setErrorInfo(null)}>Intentar de Nuevo</Button>
              </div>
            ) : lastScannedUser ? (
              <div className="flex flex-col items-center py-10 animate-in zoom-in duration-300 text-center">
                <div className={cn("w-32 h-32 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-xl mb-6", lastScannedUser.type === 'entry' ? "bg-green-100" : "bg-blue-100")}>
                   {lastScannedUser.photo ? <Image src={lastScannedUser.photo} alt={lastScannedUser.name} width={128} height={128} className="object-cover" unoptimized /> : <UserIcon className="w-16 h-16 text-gray-300" />}
                </div>
                <Badge className={cn("text-white font-black mb-2 px-4 py-1.5 rounded-xl uppercase tracking-widest", lastScannedUser.type === 'entry' ? "bg-green-500" : "bg-blue-500")}>
                  {lastScannedUser.type === 'entry' ? "INGRESO EXITOSO" : "SALIDA EXITOSA"}
                </Badge>
                <h3 className="text-3xl font-black text-gray-800">{lastScannedUser.name}</h3>
                <div className="text-muted-foreground font-bold mt-2">{lastScannedUser.time} • {lastScannedUser.shift}</div>
                <p className="text-[9px] font-black text-green-600 mt-4 uppercase">Alerta de seguridad enviada</p>
              </div>
            ) : (
              <>
                <div id={qrRegionId} className="w-full aspect-square bg-gray-50 rounded-[2.5rem] overflow-hidden border-4 border-dashed border-gray-200" />
                <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-5">
                  <div className={cn("p-3 rounded-2xl shadow-sm", location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600")}><MapPin className="w-6 h-6" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Localización de Terminal</p>
                    <p className="text-sm font-black text-gray-700">{location ? "Punto Georreferenciado" : "Validando GPS..."}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />
    </div>
  );
}
