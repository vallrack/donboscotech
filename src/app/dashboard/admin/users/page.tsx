
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Mail, Loader2, ShieldCheck, 
  UserPlus, BookOpen, MapPin, Trash2, Users,
  PlusCircle, AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole, Campus, Program, Shift } from '@/lib/types';
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
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: campuses } = useCollection<Campus>(db ? collection(db, 'campuses') : null as any);
  const { data: programs } = useCollection<Program>(db ? collection(db, 'programs') : null as any);
  
  const { data: users, loading: usersLoading } = useCollection(db ? collection(db, 'userProfiles') : null as any);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    documentId: '',
    campus: '',
    program: '',
    shiftIds: [] as string[],
    role: 'docent' as UserRole
  });

  const filteredUsers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    const list = (users || []).map(u => ({
      ...u,
      name: u.name || 'Personal sin Nombre',
      email: u.email || 'Sin Correo',
      role: u.role || 'docent',
      id: u.id || (u as any).uid
    }));
    
    list.sort((a, b) => a.name.localeCompare(b.name));
    
    return list.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search) ||
      (u.documentId && u.documentId.toLowerCase().includes(search)) ||
      u.role.toLowerCase().includes(search)
    );
  }, [users, searchTerm]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isCreating) return;
    
    if (currentUser?.role === 'coordinator' && formData.role === 'admin') {
      toast({
        variant: "destructive",
        title: "Jerarquía Protegida",
        description: "Como Coordinador, no puedes crear nuevos Administradores."
      });
      return;
    }

    setIsCreating(true);
    let tempApp;
    try {
      const appName = `temp-app-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getFirebaseAuth(tempApp);
      const userCredential = await createUserWithEmailAndPassword(tempAuth, formData.email, formData.password);
      const newUserId = userCredential.user.uid;

      const userProfile = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        documentId: formData.documentId,
        campus: formData.campus,
        program: formData.program,
        shiftIds: formData.shiftIds,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.id
      };

      await setDoc(doc(db, 'userProfiles', newUserId), userProfile);

      if (formData.role === 'admin') await setDoc(doc(db, 'roles_admins', newUserId), { email: formData.email });
      if (formData.role === 'coordinator') await setDoc(doc(db, 'roles_coordinators', newUserId), { email: formData.email });
      if (formData.role === 'secretary') await setDoc(doc(db, 'roles_secretaries', newUserId), { email: formData.email });

      toast({ title: "Personal Registrado", description: `${formData.name} ya es parte de Don Bosco Track.` });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', email: '', password: '', documentId: '', campus: '', program: '', shiftIds: [], role: 'docent' });
    } catch (error: any) {
      const isEmailInUse = error.message?.includes('email-already-in-use');
      toast({ 
        variant: "destructive", 
        title: isEmailInUse ? "Correo ya registrado" : "Error de Registro", 
        description: isEmailInUse 
          ? "Este correo ya existe en el sistema. Busca al usuario en la lista para asignarle un rol o completar sus datos." 
          : error.message 
      });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, targetRole: UserRole, userEmail: string, currentRole: string) => {
    if (!db || !userId) return;

    if (currentUser?.role === 'coordinator' && (currentRole === 'admin' || targetRole === 'admin')) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para modificar roles de administrador." });
      return;
    }

    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { role: targetRole });
      
      const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
      
      if (targetRole === 'admin') await setDoc(doc(db, 'roles_admins', userId), { email: userEmail });
      if (targetRole === 'coordinator') await setDoc(doc(db, 'roles_coordinators', userId), { email: userEmail });
      if (targetRole === 'secretary') await setDoc(doc(db, 'roles_secretaries', userId), { email: userEmail });
      
      toast({ title: "Acceso Modificado", description: "El nivel de permisos ha sido actualizado." });
    } catch (error) {
      toast({ title: "Error en Sincronización", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userRole: string) => {
    if (!db || !userId) return;
    
    if (currentUser?.role === 'coordinator' && userRole === 'admin') {
      toast({ variant: "destructive", title: "Protección Institucional", description: "No puedes dar de baja a un Administrador." });
      return;
    }

    if (confirm('¿Estás seguro de dar de baja a este miembro del personal?')) {
      try {
        await deleteDoc(doc(db, 'userProfiles', userId));
        const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
        for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
        toast({ title: "Personal Removido" });
      } catch (e) {
        toast({ variant: "destructive", title: "Error al procesar baja" });
      }
    }
  };

  if (authLoading) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Gestión de Personal</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2 mt-2">
             <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
               <ShieldCheck className="w-3.5 h-3.5 text-primary" />
             </div>
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Control Centralizado de Roles y Permisos</span>
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl shadow-primary/20 hover:scale-105 transition-all active:scale-95">
              <PlusCircle className="w-6 h-6" /> Registrar Nuevo Miembro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl overflow-y-auto max-h-[90vh] bg-white p-0 overflow-hidden">
            <form onSubmit={handleCreateUser}>
              <div className="bg-primary p-10 text-white relative">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                 <DialogTitle className="text-3xl font-black flex items-center gap-3">
                   Alta de Personal
                 </DialogTitle>
                 <DialogDescription className="text-primary-foreground/80 font-bold text-sm mt-2 uppercase tracking-widest">
                   Registro Institucional Ciudad Don Bosco
                 </DialogDescription>
              </div>
              
              <div className="p-10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre Completo</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" placeholder="Ej: Juan Bosco" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Cédula / Documento</Label>
                    <Input value={formData.documentId} onChange={(e) => setFormData({...formData, documentId: e.target.value})} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" placeholder="ID Oficial" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Correo Institucional</Label>
                    <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" placeholder="usuario@donbosco.edu" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Contraseña Temporal</Label>
                    <Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="h-12 rounded-xl border-gray-100 bg-gray-50/50" placeholder="Min. 6 caracteres" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede Principal</Label>
                    <Select value={formData.campus} onValueChange={(val) => setFormData({...formData, campus: val})}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                        <SelectValue placeholder="Seleccionar Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa / Carrera</Label>
                    <Select value={formData.program} onValueChange={(val) => setFormData({...formData, program: val})}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-100 bg-gray-50/50">
                        <SelectValue placeholder="Seleccionar Programa" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Asignar Nivel de Acceso (Rol)</Label>
                  <Select value={formData.role} onValueChange={(val: UserRole) => setFormData({...formData, role: val})}>
                    <SelectTrigger className="h-14 rounded-2xl font-black text-primary border-primary/20 bg-primary/5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="docent" className="font-bold py-3">Docente / Profesor</SelectItem>
                      <SelectItem value="secretary" className="font-bold py-3">Secretaría / Administrativo</SelectItem>
                      <SelectItem value="coordinator" className="font-bold py-3">Coordinador de Sede</SelectItem>
                      {currentUser?.role === 'admin' && <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador General</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="bg-gray-50 p-8 border-t">
                <Button type="submit" className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6 mr-2" />}
                  Confirmar Registro en el Sistema
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-10 border-b p-10">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre, correo o cédula..." 
                className="pl-12 h-14 border-gray-200 rounded-2xl shadow-sm bg-white" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border shadow-sm">
               <div className="w-3 h-3 rounded-full bg-green-500" />
               <span className="text-xs font-black uppercase tracking-widest text-gray-500">Sincronizado</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-10 py-8">Miembro Institucional</th>
                  <th className="px-10 py-8">Sede / Cargo</th>
                  <th className="px-10 py-8">Nivel de Acceso</th>
                  <th className="px-10 py-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr><td colSpan={4} className="py-40 text-center"><Loader2 className="w-16 h-16 animate-spin mx-auto text-primary opacity-20" /></td></tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isAdminUser = u.role === 'admin';
                    const isProtected = isAdminUser && currentUser?.role === 'coordinator';
                    const isSelf = currentUser?.id === u.id;
                    const isDisabled = updatingId === u.id || isSelf || isProtected;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-all group">
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:scale-105",
                              isAdminUser ? "bg-primary text-white" : "bg-primary/10 text-primary"
                            )}>
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-black text-lg flex items-center gap-2 text-gray-800">
                                {u.name}
                                {isProtected && <Badge variant="secondary" className="text-[8px] font-black bg-gray-100">PROTEGIDO</Badge>}
                                {isSelf && <Badge className="text-[8px] font-black bg-green-500 text-white border-none">YO</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-2 font-bold mt-0.5">
                                <Mail className="w-3.5 h-3.5" /> {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="space-y-2">
                             <div className="flex items-center gap-2">
                               <MapPin className="w-3.5 h-3.5 text-primary opacity-40" />
                               <span className="text-[10px] font-black uppercase tracking-wider text-gray-600">{u.campus || 'Sin sede'}</span>
                             </div>
                             <div className="flex items-center gap-2">
                               <BookOpen className="w-3.5 h-3.5 text-primary opacity-40" />
                               <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/5 px-2 py-0.5 rounded-lg">{u.program || 'Sin programa'}</span>
                             </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <Select 
                            disabled={isDisabled} 
                            onValueChange={(val) => handleRoleChange(u.id, val as UserRole, u.email, u.role)} 
                            value={u.role || 'docent'}
                          >
                            <SelectTrigger className={cn(
                              "w-48 h-12 rounded-xl text-xs font-black shadow-sm bg-white transition-all",
                              isProtected && "opacity-40 border-dashed"
                            )}>
                              {updatingId === u.id ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                              <SelectItem value="docent" className="font-bold py-3">Docente</SelectItem>
                              <SelectItem value="secretary" className="font-bold py-3">Secretaría</SelectItem>
                              <SelectItem value="coordinator" className="font-bold py-3">Coordinador</SelectItem>
                              {currentUser?.role === 'admin' && <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador General</SelectItem>}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-10 py-8 text-center">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl h-12 w-12 transition-all"
                            disabled={isDisabled}
                            onClick={() => handleDeleteUser(u.id, u.role)}
                          >
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {!usersLoading && filteredUsers.length === 0 && (
            <div className="py-40 text-center flex flex-col items-center justify-center gap-4 animate-in zoom-in duration-300">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center border-2 border-dashed border-gray-100">
                <Users className="w-10 h-10 text-gray-200" />
              </div>
              <p className="text-sm font-black text-gray-400 uppercase tracking-widest">No hay registros coincidentes</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
