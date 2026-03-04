
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
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, Mail, Loader2, ShieldCheck, UserCog, 
  ShieldAlert, UserPlus, Lock, User as UserIcon, Building2, BookOpen, MapPin, Shield
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

  const { data: campuses } = useCollection<Campus>(db ? query(collection(db, 'campuses'), orderBy('name')) : null as any);
  const { data: programs } = useCollection<Program>(db ? query(collection(db, 'programs'), orderBy('name')) : null as any);
  const { data: shifts } = useCollection<Shift>(db ? query(collection(db, 'shifts'), orderBy('name')) : null as any);
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
      name: u.name || 'Sin Nombre',
      email: u.email || 'Sin Email'
    }));
    list.sort((a: any, b: any) => a.name.localeCompare(b.name));
    return list.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search) ||
      u.documentId?.toLowerCase().includes(search)
    );
  }, [users, searchTerm]);

  const toggleShift = (shiftId: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      return { ...prev, shiftIds: current.includes(shiftId) ? current.filter(id => id !== shiftId) : [...current, shiftId] };
    });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isCreating) return;
    
    // Restricción: Coordinador no puede crear Administradores
    if (currentUser?.role === 'coordinator' && formData.role === 'admin') {
      toast({
        variant: "destructive",
        title: "Permiso denegado",
        description: "Como coordinador, no puedes registrar nuevos administradores."
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

      await setDoc(doc(db, 'userProfiles', newUserId), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        documentId: formData.documentId,
        campus: formData.campus,
        program: formData.program,
        shiftIds: formData.shiftIds,
        createdAt: serverTimestamp(),
        createdBy: currentUser?.id
      });

      if (formData.role === 'admin') await setDoc(doc(db, 'roles_admins', newUserId), { email: formData.email });
      if (formData.role === 'coordinator') await setDoc(doc(db, 'roles_coordinators', newUserId), { email: formData.email });
      if (formData.role === 'secretary') await setDoc(doc(db, 'roles_secretaries', newUserId), { email: formData.email });

      toast({ title: "Usuario Creado", description: `Se ha registrado a ${formData.name}.` });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', email: '', password: '', documentId: '', campus: '', program: '', shiftIds: [], role: 'docent' });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, targetRole: UserRole, userEmail: string, currentRole: string) => {
    if (!db || !userId) return;

    // RESTRICCIÓN CRÍTICA: Coordinador no puede modificar a un Administrador
    if (currentUser?.role === 'coordinator' && currentRole === 'admin') {
      toast({
        variant: "destructive",
        title: "Acción bloqueada",
        description: "Los coordinadores no tienen permisos para gestionar cuentas de administrador."
      });
      return;
    }

    // RESTRICCIÓN: Coordinador no puede elevar a alguien a Administrador
    if (currentUser?.role === 'coordinator' && targetRole === 'admin') {
      toast({
        variant: "destructive",
        title: "Acción bloqueada",
        description: "No tienes permisos para asignar roles de administrador."
      });
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
      
      toast({ title: "Acceso Actualizado" });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  if (authLoading) return null;

  const isPrivileged = currentUser?.role === 'admin' || currentUser?.role === 'coordinator';

  if (!isPrivileged) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-gray-50 rounded-3xl animate-in fade-in duration-500">
        <ShieldAlert className="w-16 h-16 text-destructive mb-6 opacity-20" />
        <h2 className="text-3xl font-black text-destructive">Acceso Restringido</h2>
        <p className="text-muted-foreground font-bold">Solo personal administrativo puede gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">Gestión de Personal</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
             <ShieldCheck className="w-4 h-4 text-primary" />
             <span className="text-xs font-bold uppercase tracking-wider">Control total de roles y carnets institucionales</span>
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-12 px-6 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20">
              <UserPlus className="w-5 h-5" /> Nuevo Miembro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px] rounded-3xl border-none shadow-2xl overflow-y-auto max-h-[90vh]">
            <form onSubmit={handleCreateUser}>
              <DialogHeader><DialogTitle className="text-2xl font-black text-primary">Agregar Personal</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
                <div className="space-y-2"><Label>Nombre</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label>Identificación</Label><Input value={formData.documentId} onChange={(e) => setFormData({...formData, documentId: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label>Correo</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label>Contraseña</Label><Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label>Sede</Label><Select value={formData.campus} onValueChange={(val) => setFormData({...formData, campus: val})}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Programa</Label><Select value={formData.program} onValueChange={(val) => setFormData({...formData, program: val})}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Jornadas</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    {shifts?.map(s => (
                      <div key={s.id} className="flex items-center space-x-3 bg-white p-3 rounded-xl border">
                        <Checkbox id={`shift-${s.id}`} checked={formData.shiftIds.includes(s.id)} onCheckedChange={() => toggleShift(s.id)} />
                        <label htmlFor={`shift-${s.id}`} className="text-xs font-bold">{s.name} ({s.startTime}-{s.endTime})</label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Rol</Label>
                  <Select value={formData.role} onValueChange={(val: UserRole) => setFormData({...formData, role: val})}>
                    <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="docent">Docente</SelectItem>
                      <SelectItem value="secretary">Secretaría</SelectItem>
                      <SelectItem value="coordinator">Coordinador</SelectItem>
                      {currentUser?.role === 'admin' && <SelectItem value="admin">Administrador</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit" className="w-full h-12 rounded-xl font-black" disabled={isCreating}>{isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Registro"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-6 border-b p-8"><div className="relative max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" /><Input placeholder="Buscar por nombre, correo o ID..." className="pl-12 h-14 border-gray-200 rounded-2xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="bg-gray-50/30 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground"><th className="px-8 py-6">Personal</th><th className="px-8 py-6">Info</th><th className="px-8 py-6">Permisos</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (<tr><td colSpan={3} className="py-24 text-center"><Loader2 className="w-12 h-12 animate-spin mx-auto text-primary opacity-20" /></td></tr>) : (
                  filteredUsers.map((u) => {
                    const isProtectedAdmin = u.role === 'admin' && currentUser?.role === 'coordinator';
                    const isSelf = currentUser?.id === u.id;
                    const isDisabled = updatingId === u.id || isSelf || isProtectedAdmin;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-all">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center font-black",
                              u.role === 'admin' ? "bg-primary text-white" : "bg-primary/10 text-primary"
                            )}>
                              {u.role === 'admin' ? <Shield className="w-6 h-6" /> : u.name?.charAt(0)}
                            </div>
                            <div>
                              <div className="font-black text-base flex items-center gap-2">
                                {u.name}
                                {isProtectedAdmin && <Badge variant="secondary" className="text-[8px]">PROTEGIDO</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6"><div className="space-y-1"><div className="text-[10px] font-black uppercase"><MapPin className="w-3 h-3 inline mr-1" /> {u.campus || 'Sin Sede'}</div><div className="text-[10px] font-black uppercase text-primary"><BookOpen className="w-3 h-3 inline mr-1" /> {u.program || 'Sin Programa'}</div></div></td>
                        <td className="px-8 py-6">
                          <Select 
                            disabled={isDisabled} 
                            onValueChange={(val) => handleRoleChange(u.id, val as UserRole, u.email, u.role)} 
                            value={u.role || 'docent'}
                          >
                            <SelectTrigger className={cn(
                              "w-48 h-10 rounded-xl text-xs font-black",
                              isProtectedAdmin && "opacity-50 border-dashed"
                            )}>
                              {updatingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="docent">Docente</SelectItem>
                              <SelectItem value="secretary">Secretaría</SelectItem>
                              <SelectItem value="coordinator">Coordinador</SelectItem>
                              {currentUser?.role === 'admin' && <SelectItem value="admin">Administrador</SelectItem>}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
