
"use client"

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Loader2, ShieldCheck, 
  PlusCircle, MapPin, BookOpen, Trash2, Plus, Trash, Edit3, Save, X as CloseIcon, UserCheck, ShieldAlert, Lock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole, Campus, Program, Shift, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);

  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: shiftsRaw } = useCollection<Shift>(shiftsQuery);
  const { data: usersRaw, loading: usersLoading } = useCollection<User>(usersQuery as any);

  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const shifts = useMemo(() => shiftsRaw || [], [shiftsRaw]);
  const users = useMemo(() => usersRaw || [], [usersRaw]);

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

  const updateFormField = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleShift = useCallback((id: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
      return { ...prev, shiftIds: next };
    });
  }, []);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return users.filter(u => 
      u.name?.toLowerCase().includes(search) || 
      u.email?.toLowerCase().includes(search) ||
      u.documentId?.toLowerCase().includes(search)
    );
  }, [users, searchTerm]);

  const resetForm = useCallback(() => {
    setFormData({ name: '', email: '', password: '', documentId: '', campus: '', program: '', shiftIds: [], role: 'docent' });
    setEditingUser(null);
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || isSaving) return;
    
    setIsSaving(true);
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
        createdBy: currentUser?.id,
        status: 'active'
      };

      await setDoc(doc(db, 'userProfiles', newUserId), userProfile);

      if (formData.role !== 'docent') {
        const col = formData.role === 'admin' ? 'roles_admins' : formData.role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
        await setDoc(doc(db, col, newUserId), { email: formData.email, assignedAt: new Date().toISOString() });
      }

      toast({ title: "Personal Registrado Exitosamente" });
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Registro", description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsSaving(false);
    }
  };

  const handleEditClick = (u: User) => {
    // Restricción: Coordinador no puede editar Admin
    if (currentUser?.role === 'coordinator' && u.role === 'admin') {
      toast({ variant: "destructive", title: "Acción Restringida", description: "Un coordinador no puede gestionar perfiles de administrador." });
      return;
    }

    setEditingUser(u);
    setFormData({
      name: u.name || '',
      email: u.email || '',
      password: '',
      documentId: u.documentId || '',
      campus: u.campus || '',
      program: u.program || '',
      shiftIds: u.shiftIds || [],
      role: u.role || 'docent'
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editingUser || isSaving) return;

    setIsSaving(true);
    try {
      const updateData = {
        name: formData.name,
        documentId: formData.documentId,
        campus: formData.campus,
        program: formData.program,
        shiftIds: formData.shiftIds,
        role: formData.role,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'userProfiles', editingUser.id), updateData);

      if (formData.role !== editingUser.role) {
        const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
        for (const col of rolesCols) await deleteDoc(doc(db, col, editingUser.id));
        if (formData.role !== 'docent') {
          const col = formData.role === 'admin' ? 'roles_admins' : formData.role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
          await setDoc(doc(db, col, editingUser.id), { email: formData.email, assignedAt: new Date().toISOString() });
        }
      }

      toast({ title: "Perfil actualizado satisfactoriamente" });
      setIsEditDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al actualizar", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId: string, targetRole?: string) => {
    // Restricción: Coordinador no puede eliminar Admin
    if (currentUser?.role === 'coordinator' && targetRole === 'admin') {
      toast({ variant: "destructive", title: "Acción Restringida", description: "No tienes permisos para dar de baja a un administrador." });
      return;
    }

    if (!db || !confirm('¿Dar de baja a este miembro de forma permanente?')) return;
    try {
      await deleteDoc(doc(db, 'userProfiles', userId));
      const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
      toast({ title: "Personal removido de la base de datos" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'coordinator') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldAlert className="w-16 h-16 text-destructive mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-destructive">Acceso Denegado</h2>
        <p className="text-muted-foreground mt-2">Solo personal administrativo puede gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Gestión de Personal</h1>
          <p className="text-muted-foreground font-medium mt-2">Administra roles, sedes y jornadas institucionales.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={(val) => { setIsCreateDialogOpen(val); if(!val) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl">
              <PlusCircle className="w-6 h-6" /> Registrar Nuevo Miembro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
            <DialogHeader className="p-10 pb-0">
              <DialogTitle className="text-2xl font-black text-gray-800">Inscripción Institucional</DialogTitle>
            </DialogHeader>
            <div className="overflow-y-auto flex-1 p-10 pt-4 space-y-8">
              <form onSubmit={handleCreateUser}>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre Completo</Label>
                      <Input value={formData.name} onChange={(e) => updateFormField('name', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Número de Cédula</Label>
                      <Input value={formData.documentId} onChange={(e) => updateFormField('documentId', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Correo Institucional</Label>
                      <Input type="email" value={formData.email} onChange={(e) => updateFormField('email', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Contraseña de Acceso</Label>
                      <Input type="password" value={formData.password} onChange={(e) => updateFormField('password', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede de Trabajo</Label>
                      <Select value={formData.campus || undefined} onValueChange={(val) => updateFormField('campus', val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                        <SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold">{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa / Proceso</Label>
                      <Select value={formData.program || undefined} onValueChange={(val) => updateFormField('program', val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                        <SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold">{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Asignación de Jornadas</Label>
                    <Select onValueChange={(val) => toggleShift(val)}>
                      <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold">
                        <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /><span>Añadir Jornada Oficial</span></div>
                      </SelectTrigger>
                      <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={s.id} className="font-bold py-3">{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                      {formData.shiftIds.map(id => {
                        const s = shifts.find(sh => sh.id === id);
                        return <Badge key={id} variant="secondary" className="px-3 py-1 font-black gap-2">{s?.name}<Trash className="w-3 h-3 cursor-pointer" onClick={() => toggleShift(id)} /></Badge>
                      })}
                    </div>
                  </div>
                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nivel de Permisos (Rol)</Label>
                    <Select value={formData.role} onValueChange={(val: UserRole) => updateFormField('role', val)}>
                      <SelectTrigger className="h-14 rounded-2xl font-black text-primary border-primary/20 bg-primary/5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="docent" className="font-bold py-3">Docente</SelectItem>
                        <SelectItem value="secretary" className="font-bold py-3">Secretaría</SelectItem>
                        <SelectItem value="coordinator" className="font-bold py-3">Coordinador</SelectItem>
                        <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" disabled={isSaving}>
                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6 mr-2" />}
                    Confirmar Registro Oficial
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(val) => { setIsEditDialogOpen(val); if(!val) resetForm(); }}>
        <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-10 pb-0">
            <DialogTitle className="text-2xl font-black text-gray-800">Actualizar Perfil de Miembro</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-10 pt-4 space-y-8">
            <form onSubmit={handleUpdateUser}>
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre Completo</Label>
                    <Input value={formData.name} onChange={(e) => updateFormField('name', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Cédula</Label>
                    <Input value={formData.documentId} onChange={(e) => updateFormField('documentId', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede de Trabajo</Label>
                    <Select value={formData.campus || undefined} onValueChange={(val) => updateFormField('campus', val)}>
                      <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                      <SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold">{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa / Proceso</Label>
                    <Select value={formData.program || undefined} onValueChange={(val) => updateFormField('program', val)}>
                      <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                      <SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold">{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Jornadas Oficiales</Label>
                  <Select onValueChange={(val) => toggleShift(val)}>
                    <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold">
                      <div className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /><span>Añadir Jornada</span></div>
                    </SelectTrigger>
                    <SelectContent>{shifts?.map(s => <SelectItem key={s.id} value={s.id} className="font-bold py-3">{s.name} ({s.startTime} - {s.endTime})</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="flex flex-wrap gap-2">
                    {formData.shiftIds.map(id => {
                      const s = shifts.find(sh => sh.id === id);
                      return <Badge key={id} variant="secondary" className="px-3 py-1 font-black gap-2">{s?.name}<Trash className="w-3 h-3 cursor-pointer" onClick={() => toggleShift(id)} /></Badge>
                    })}
                  </div>
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Rol en la Institución</Label>
                  <Select value={formData.role} onValueChange={(val: UserRole) => updateFormField('role', val)}>
                    <SelectTrigger className="h-14 rounded-2xl font-black text-primary border-primary/20 bg-primary/5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="docent" className="font-bold py-3">Docente</SelectItem>
                      <SelectItem value="secretary" className="font-bold py-3">Secretaría</SelectItem>
                      <SelectItem value="coordinator" className="font-bold py-3">Coordinador</SelectItem>
                      <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />}
                  Guardar Cambios Oficiales
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-10 border-b p-10">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input 
              placeholder="Buscar por nombre, correo o cédula..." 
              className="pl-12 w-full h-14 border-gray-200 rounded-2xl shadow-sm bg-white font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-10 py-8">Miembro</th><th className="px-10 py-8">Sede / Programa</th><th className="px-10 py-8">Rol</th><th className="px-10 py-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr><td colSpan={4} className="py-40 text-center"><Loader2 className="w-16 h-16 animate-spin mx-auto text-primary opacity-20" /></td></tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isProtected = currentUser?.role === 'coordinator' && u.role === 'admin';
                    return (
                      <tr key={u.id} className={cn("hover:bg-gray-50/50 transition-all group", isProtected && "opacity-80")}>
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-6">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg", u.role === 'admin' ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                              {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div><div className="font-black text-lg text-gray-800">{u.name}</div><div className="text-xs text-muted-foreground font-bold">{u.email}</div></div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase"><MapPin className="w-3.5 h-3.5" /> {u.campus || 'Sin Sede Asignada'}</div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase"><BookOpen className="w-3.5 h-3.5" /> {u.program || 'Sin Programa / Proceso'}</div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="font-black uppercase text-[10px] px-4 py-1.5 rounded-xl">
                            {u.role || 'docent'}
                          </Badge>
                        </td>
                        <td className="px-10 py-8">
                          <div className="flex items-center justify-center gap-2">
                            {isProtected ? (
                              <div className="flex items-center gap-1 text-[9px] font-black text-muted-foreground uppercase bg-gray-100 px-3 py-1.5 rounded-lg">
                                <Lock className="w-3 h-3" /> Nivel Superior
                              </div>
                            ) : (
                              <>
                                <Button variant="ghost" size="icon" className="text-primary hover:bg-primary/5 rounded-xl h-12 w-12" onClick={() => handleEditClick(u)}>
                                  <Edit3 className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl h-12 w-12" onClick={() => handleDeleteUser(u.id, u.role)}>
                                  <Trash2 className="w-5 h-5" />
                                </Button>
                              </>
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
        </CardContent>
      </Card>
    </div>
  );
}
