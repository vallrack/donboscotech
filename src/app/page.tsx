"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, GraduationCap } from 'lucide-react';
import Image from 'next/image';

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const { user, login, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !authLoading) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login();
    } catch (err) {
      console.error(err);
      alert('Error al iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
        <Image 
          src="https://ciudaddonbosco.org/wp-content/uploads/2025/07/CIUDAD-DON-BOSCO_CABECERA-04-1024x284.png"
          alt="Ciudad Don Bosco Logo"
          width={320}
          height={88}
          className="mx-auto mb-4"
          priority
        />
        <h1 className="text-3xl font-bold text-primary tracking-tight">Don Bosco Track</h1>
        <p className="text-muted-foreground mt-2">Sistema de Gestión de Asistencia Institucional</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            Iniciar Sesión
          </CardTitle>
          <CardDescription>
            Acceda de forma segura con su cuenta institucional de Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-12 flex items-center justify-center gap-3 text-base font-medium"
            onClick={handleLogin}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {loading ? 'Ingresando...' : 'Continuar con Google'}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 w-full text-xs text-muted-foreground pt-4 border-t">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Acceso Seguro
            </div>
            <div className="flex items-center gap-1 justify-end">
              <GraduationCap className="w-3 h-3" /> Exclusivo Institucional
            </div>
          </div>
        </CardFooter>
      </Card>
      
      <div className="mt-12 max-w-sm text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          &copy; {new Date().getFullYear()} Ciudad Don Bosco. Todos los derechos reservados. 
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
