
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Mail, Loader2, ShieldCheck, UserCog, 
  ShieldAlert, UserPlus, Lock, User as UserIcon 
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New User Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('docent');

  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), orderBy('name', 'asc'));
  }, [db]);

  const { data: users, loading } = useCollection(usersQuery as any);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isCreating) return;

    setIsCreating(true);
    let tempApp;
    try {
      const appName = `temp-app-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getFirebaseAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, newEmail, newPassword);
      const newUserId = userCredential.user.uid;

      await setDoc(doc(db, 'userProfiles', newUserId), {
        name: newName,
        email: newEmail,
        role: newRole,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.id
      });

      if (newRole === 'admin') {
        await setDoc(doc(db, 'roles_admins', newUserId), { email: newEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'coordinator') {
        await setDoc(doc(db, 'roles_coordinators', newUserId), { email: newEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'secretary') {
        await setDoc(doc(db, 'roles_secretaries', newUserId), { email: newEmail, assignedAt: new Date().toISOString() });
      }

      toast({
        title: "Usuario Creado",
        description: `Se ha registrado exitosamente a ${newName} como ${newRole.toUpperCase()}.`
      });

      setIsCreateDialogOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('docent');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al crear usuario",
        description: error.message || "No se pudo registrar al usuario."
      });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole, userEmail: string) => {
    if (!db || !userId) return;
    
    // Self-protection: Don't allow an admin to remove their own admin role
    if (currentUser?.id === userId && newRole !== 'admin') {
      toast({
        variant: "destructive",
        title: "Operación no permitida",
        description: "No puedes quitarte tus propios permisos administrativos."
      });
      return;
    }

    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { 
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      const roleCollections = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of roleCollections) {
        await deleteDoc(doc(db, col, userId));
      }

      if (newRole === 'admin') {
        await setDoc(doc(db, 'roles_admins', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'coordinator') {
        await setDoc(doc(db, 'roles_coordinators', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'secretary') {
        await setDoc(doc(db, 'roles_secretaries', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      }

      toast({ 
        title: "Permisos Actualizados", 
        description: `Acceso actualizado a nivel ${newRole.toUpperCase()}.` 
      });
    } catch (error) {
      toast({ 
        title: "Error de sincronización", 
        description: "No se pudieron actualizar las reglas de acceso.",
        variant: "destructive" 
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">Gestión de Personal</h1>
          <div className="text-muted-foreground flex items-center gap-2 mt-1">
             <ShieldCheck className="w-4 h-4 text-primary" />
             <span className="text-xs font-bold uppercase tracking-wider">Control de roles y accesos institucionales</span>
          </div>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="w-5 h-5" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl border-none shadow-2xl">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-primary">Agregar Miembro</DialogTitle>
                <DialogDescription className="font-medium">
                  Crea una nueva cuenta de acceso para el personal.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre Completo</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ej: Juan Bosco" className="pl-10 h-12 rounded-xl border-gray-100" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Correo Electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="correo@donbosco.edu" className="pl-10 h-12 rounded-xl border-gray-100" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pass" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contraseña Inicial</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                    <Input id="pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-12 rounded-xl border-gray-100" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rol Asignado</Label>
                  <Select value={newRole} onValueChange={(val: UserRole) => setNewRole(val)}>
                    <SelectTrigger className="h-12 rounded-xl border-gray-100 font-bold">
                      <SelectValue placeholder="Seleccionar Rol" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl">
                      <SelectItem value="docent" className="font-bold py-3">Docente (Acceso Base)</SelectItem>
                      <SelectItem value="secretary" className="font-bold py-3">Secretaría (Reportes)</SelectItem>
                      <SelectItem value="coordinator" className="font-bold py-3">Coordinador (Marcaje Manual)</SelectItem>
                      <SelectItem value="admin" className="font-black py-3 text-primary">Administrador (Total)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 rounded-xl font-black text-lg" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
                  Crear Cuenta de Personal
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-6 border-b p-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, apellido o correo electrónico..." 
              className="pl-12 h-14 border-gray-200 rounded-2xl bg-white shadow-sm text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Información del Usuario</th>
                  <th className="px-8 py-6">Nivel de Acceso</th>
                  <th className="px-8 py-6">Acción de Permisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr key="loading-users">
                    <td colSpan={3} className="py-24 text-center">
                      <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary opacity-20" />
                      <p className="text-sm mt-4 font-bold text-muted-foreground">Sincronizando con base de datos...</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const userId = u.id;
                    const isUpdating = updatingId === userId;
                    const isSelf = currentUser?.id === userId;
                    const currentRole = u.role || 'docent';
                    
                    return (
                      <tr key={userId} className="hover:bg-gray-50/50 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">
                               {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <div className="font-black text-base text-gray-800 flex items-center gap-2">
                                <span>{u.name}</span>
                                {isSelf && <Badge variant="outline" className="text-[9px] font-black text-primary border-primary/20">TÚ</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium mt-0.5">
                                <Mail className="w-3.5 h-3.5" /> {u.email}
                              </div>
                            </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge 
                            variant={currentRole === 'admin' ? 'default' : 'secondary'} 
                            className={cn(
                              "w-fit capitalize text-[10px] font-black px-4 py-1.5 rounded-xl border-none",
                              currentRole === 'admin' ? "bg-primary shadow-lg shadow-primary/20" : "bg-gray-200 text-gray-700"
                            )}
                          >
                            {currentRole === 'docent' ? 'Docente' : 
                             currentRole === 'coordinator' ? 'Coordinador' : 
                             currentRole === 'secretary' ? 'Secretaría' : 'Administrador'}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <Select 
                              disabled={isUpdating || isSelf}
                              onValueChange={(val) => handleRoleChange(userId, val as UserRole, u.email)}
                              value={currentRole}
                            >
                              <SelectTrigger className="w-52 h-12 rounded-2xl text-xs font-black border-gray-200 shadow-sm bg-white">
                                <div className="flex items-center gap-2">
                                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <UserCog className="w-4 h-4 text-primary" />}
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="docent" className="font-bold py-3">Docente (Acceso Base)</SelectItem>
                                <SelectItem value="secretary" className="font-bold py-3">Secretaría (Reportes)</SelectItem>
                                <SelectItem value="coordinator" className="font-bold py-3">Coordinador (Marcaje Manual)</SelectItem>
                                <SelectItem value="admin" className="font-black py-3 text-primary">Administrador (Total)</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {currentRole === 'admin' && !isSelf && (
                              <div className="p-2 bg-yellow-50 rounded-xl text-yellow-600" title="Acceso de alto nivel">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredUsers.length === 0 && (
            <div className="p-24 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-gray-200" />
              </div>
              <p className="text-muted-foreground font-bold text-lg">No se encontraron usuarios registrados.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50 pt-4">
        &copy; Sistema de Gestión de Permisos Ciudad Don Bosco
      </p>
    </div>
  );
}
