
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldCheck, GraduationCap, Mail, Lock, Loader2, UserPlus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/lib/types';
import Image from 'next/image';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('docent');
  const { user, login, loginWithEmail, signUpWithEmail, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (user && !authLoading) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await login();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error de autenticación',
        description: 'No se pudo iniciar sesión con Google.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error de acceso',
        description: 'Correo o contraseña incorrectos.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !name) return;

    setLoading(true);
    try {
      await signUpWithEmail(email, password, name, role);
      toast({
        title: 'Cuenta creada',
        description: role === 'docent' 
          ? 'Bienvenido, profesor. Ya puedes acceder al sistema.' 
          : 'Bienvenido al equipo administrativo.',
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Error de registro',
        description: err.message || 'No se pudo crear la cuenta.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
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
        <p className="text-muted-foreground mt-2 text-sm font-medium uppercase tracking-widest">Gestión de Asistencia Institucional</p>
      </div>

      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary bg-white rounded-3xl overflow-hidden">
        <CardHeader className="space-y-1 pb-8">
          <CardTitle className="text-3xl font-black text-gray-800">Bienvenido</CardTitle>
          <CardDescription className="text-base font-medium">
            Inicia sesión o crea tu perfil institucional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-100 p-1.5 rounded-2xl h-14">
              <TabsTrigger value="login" className="rounded-xl font-bold text-sm">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="rounded-xl font-bold text-sm">Registro</TabsTrigger>
              <TabsTrigger value="google" className="rounded-xl font-bold text-sm">Google</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Institucional</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      id="email" 
                      type="email" 
                      placeholder="usuario@donbosco.edu" 
                      className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" dir="ltr" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      id="password" 
                      type="password" 
                      className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full font-black text-lg h-14 rounded-2xl shadow-lg shadow-primary/20 mt-4" disabled={loading}>
                  {loading ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : "Iniciar Sesión"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre Completo</Label>
                  <div className="relative">
                    <UserPlus className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      id="reg-name" 
                      type="text" 
                      placeholder="Ej: Juan Bosco" 
                      className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Correo Institucional</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      id="reg-email" 
                      type="email" 
                      placeholder="usuario@donbosco.edu" 
                      className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-role" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Tipo de Perfil</Label>
                  <div className="relative">
                    <Users className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground z-10" />
                    <Select value={role} onValueChange={(val: UserRole) => setRole(val)}>
                      <SelectTrigger className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold">
                        <SelectValue placeholder="Seleccionar Rol" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-none shadow-2xl">
                        <SelectItem value="docent" className="font-bold py-3">Docente / Profesor</SelectItem>
                        <SelectItem value="secretary" className="font-bold py-3">Secretaría / Administrativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password" dir="ltr" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                    <Input 
                      id="reg-password" 
                      type="password" 
                      className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full font-black text-lg h-14 rounded-2xl shadow-lg shadow-primary/20 mt-4" disabled={loading}>
                  {loading ? <Loader2 className="w-6 h-6 mr-2 animate-spin" /> : "Crear Mi Perfil"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="google">
              <div className="space-y-6 pt-4 text-center">
                <p className="text-sm text-muted-foreground font-medium">
                  Acceso rápido y seguro con tu cuenta de Google Institucional.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full h-14 flex items-center justify-center gap-4 text-base font-bold border-gray-200 rounded-2xl shadow-sm bg-white hover:bg-gray-50 transition-all"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {loading ? 'Ingresando...' : 'Continuar con Google'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex flex-col gap-6 pt-4 pb-8">
          <div className="flex items-center justify-between w-full px-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground border-t pt-8">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Acceso Cifrado
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" /> Ciudad Don Bosco
            </div>
          </div>
        </CardFooter>
      </Card>
      
      <div className="mt-10 max-w-sm text-center">
        <p className="text-[11px] text-muted-foreground font-bold leading-relaxed uppercase tracking-tighter opacity-50">
          &copy; {new Date().getFullYear()} Ciudad Don Bosco. Sistema oficial de control administrativo.
        </p>
      </div>
    </div>
  );
}
