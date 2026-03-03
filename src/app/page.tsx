"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LogIn, ShieldCheck, GraduationCap } from 'lucide-react';
import Image from 'next/image';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email);
      router.push('/dashboard');
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Login fallido'));
    } finally {
      setLoading(false);
    }
  };

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
            <LogIn className="w-5 h-5" /> Iniciar Sesión
          </CardTitle>
          <CardDescription>
            Ingrese su correo institucional para acceder al panel.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nombre.apellido@donbosco.edu" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="focus:ring-primary"
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full h-11 text-lg font-medium" disabled={loading}>
              {loading ? 'Ingresando...' : 'Entrar'}
            </Button>
            <div className="grid grid-cols-2 gap-4 w-full text-xs text-muted-foreground pt-4 border-t">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Acceso Seguro
              </div>
              <div className="flex items-center gap-1 justify-end">
                <GraduationCap className="w-3 h-3" /> Exclusivo Docentes
              </div>
            </div>
          </CardFooter>
        </form>
      </Card>
      
      <div className="mt-12 max-w-sm text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          &copy; {new Date().getFullYear()} Ciudad Don Bosco. Todos los derechos reservados. 
          Desarrollado para la excelencia educativa y administrativa.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}