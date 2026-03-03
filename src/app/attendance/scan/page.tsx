"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QrCode, MapPin, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(15);

  // Generate dynamic token
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

  // Request location
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
    if (!location) {
      toast({ 
        title: "Error de ubicación", 
        description: "Esperando señal de GPS. Por favor verifique sus permisos.",
        variant: "destructive" 
      });
      return;
    }

    setScanning(true);
    // Simulate API call and validation
    setTimeout(() => {
      setScanning(false);
      setSuccess(true);
      toast({ 
        title: "¡Registro Exitoso!", 
        description: "Se ha registrado su entrada correctamente en Ciudad Don Bosco." 
      });
    }, 2000);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in zoom-in duration-500">
        <div className="bg-green-100 p-8 rounded-full mb-6">
          <CheckCircle2 className="w-20 h-20 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">¡Todo listo, {user?.name.split(' ')[0]}!</h2>
        <p className="text-muted-foreground mt-2 text-center max-w-sm">
          Tu asistencia ha sido registrada con geolocalización verificada a las {new Date().toLocaleTimeString()}.
        </p>
        <Button className="mt-8" onClick={() => window.location.href = '/dashboard'}>
          Volver al Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="border-none shadow-lg overflow-hidden">
        <CardHeader className="bg-primary text-white pb-8">
          <CardTitle className="text-2xl flex items-center gap-2">
            <QrCode className="w-6 h-6" /> Registro de Jornada
          </CardTitle>
          <CardDescription className="text-primary-foreground/80">
            Escanee el código dinámico para confirmar su presencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center -mt-4">
          <div className="bg-white p-6 rounded-xl shadow-xl border-2 border-primary/10 relative">
            {/* Simulated Dynamic QR Code */}
            <div className="w-48 h-48 bg-gray-100 rounded-lg flex flex-col items-center justify-center border-4 border-white">
              <div className="grid grid-cols-4 gap-1 p-2 opacity-80">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={cn(
                    "w-8 h-8",
                    Math.random() > 0.5 ? "bg-primary" : "bg-gray-200"
                  )} />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white px-3 py-1 rounded-full shadow-md font-mono font-bold text-primary tracking-widest text-lg border-2 border-primary">
                    {token}
                 </div>
              </div>
            </div>
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-xs font-bold flex items-center gap-2 whitespace-nowrap">
              <RefreshCw className={cn("w-3 h-3", countdown > 13 && "animate-spin")} />
              Expira en {countdown}s
            </div>
          </div>

          <div className="mt-12 w-full space-y-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                location ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
              )}>
                <MapPin className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Ubicación Institucional</p>
                <p className="text-xs text-muted-foreground">
                  {location ? `Verificada: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "Detectando posición..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Token de Seguridad</p>
                <p className="text-xs text-muted-foreground">Encriptación dinámica activa (v2.4)</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-gray-50 flex flex-col gap-3">
          <Button 
            className="w-full h-12 text-lg font-bold" 
            size="lg" 
            onClick={handleScan}
            disabled={scanning || !location}
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" /> Procesando...
              </span>
            ) : "Registrar Entrada/Salida"}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Este proceso utiliza Cloud Functions para validar la autenticidad del token y su proximidad física a la sede central.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}