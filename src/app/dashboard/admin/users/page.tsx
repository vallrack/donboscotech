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
  PlusCircle, MapPin, BookOpen, Trash2, Plus, Trash, Check, X as CloseIcon
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole, Campus, Program, Shift } from '@/lib/types';
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
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);
  const usersQuery = useMemoFirebase(() => db ? query(collection(db, 'userProfiles'), orderBy('name')) : null, [db]);

  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: shiftsRaw } = useCollection<Shift>(shiftsQuery);
  const { data: usersRaw, loading: usersLoading } = useCollection(usersQuery);

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

  const updateCreateField = useCallback((field: string, value: any) => {
    setFormData(prev => {
      if (prev[field as keyof typeof prev] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const toggleCreateShift = useCallback((id: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const next = current.includes(id) ? current.filter(i => i !== id) : [...current, id];
      return { ...prev, shiftIds: next };
    });
  }, []);

  const filteredUsers = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return (users || []).filter(u => 
      u.name?.toLowerCase().includes(search) || 
      u.email?.toLowerCase().includes(search) ||
      u.documentId?.toLowerCase().includes(search)
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
        await setDoc(doc(db, col, newUserId), { email: formData.email });
      }

      toast({ title: "Personal Registrado Exitosamente" });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', email: '', password: '', documentId: '', campus: '', program: '', shiftIds: [], role: 'docent' });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Registro", description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsCreating(false);
    }
  };

  const handleRoleChange = useCallback(async (userId: string, targetRole: UserRole, userEmail: string) => {
    if (!db || updatingId) return;
    setUpdatingId(userId);
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { role: targetRole });
      const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
      if (targetRole !== 'docent') {
        const col = targetRole === 'admin' ? 'roles_admins' : targetRole === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
        await setDoc(doc(db, col, userId), { email: userEmail });
      }
      toast({ title: "Rol de acceso actualizado" });
    } catch (error) {
      toast({ title: "Error al actualizar rol", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  }, [db, updatingId, toast]);

  const handleDeleteUser = async (userId: string) => {
    if (!db || !confirm('¿Dar de baja a este miembro del personal?')) return;
    try {
      await deleteDoc(doc(db, 'userProfiles', userId));
      const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
      toast({ title: "Personal removido del sistema" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al eliminar" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Gestión de Personal</h1>
          <p className="text-muted-foreground font-medium mt-2">Administra los roles, sedes y jornadas de Ciudad Don Bosco.</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl hover:scale-105 transition-all">
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
                      <Input value={formData.name} onChange={(e) => updateCreateField('name', e.target.value)} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" placeholder="Ej: Juan Bosco" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Documento de Identidad</Label>
                      <Input value={formData.documentId} onChange={(e) => updateCreateField('documentId', e.target.value)} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" placeholder="Cédula" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Correo Institucional</Label>
                      <Input type="email" value={formData.email} onChange={(e) => updateCreateField('email', e.target.value)} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" placeholder="usuario@donbosco.edu" required />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Contraseña Temporal</Label>
                      <Input type="password" value={formData.password} onChange={(e) => updateCreateField('password', e.target.value)} className="h-12 rounded-xl bg-gray-50/50 border-gray-100" placeholder="Min. 6 caracteres" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede Asignada</Label>
                      <Select value={formData.campus || undefined} onValueChange={(val) => updateCreateField('campus', val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-100"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                        <SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa / Carrera</Label>
                      <Select value={formData.program || undefined} onValueChange={(val) => updateCreateField('program', val)}>
                        <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-100"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                        <SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Jornadas Laborales (Asignación Múltiple)</Label>
                    <Select onValueChange={(val) => toggleCreateShift(val)}>
                      <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 border-gray-100 font-bold">
                        <div className="flex items-center gap-2">
                          <Plus className="w-4 h-4 text-primary" />
                          <span>Añadir Jornada</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {shifts?.map(s => (
                          <SelectItem key={s.id} value={s.id} className="font-bold py-3">
                             <div className="flex items-center gap-2">
                               {s.name} ({s.startTime} - {s.endTime})
                               {formData.shiftIds?.includes(s.id) && <Check className="w-3 h-3 text-green-500" />}
                             </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-2">
                       {formData.shiftIds.map(id => {
                         const s = shifts.find(sh => sh.id === id);
                         return (
                           <Badge key={id} variant="secondary" className="px-3 py-1 font-black gap-2">
                             {s?.name}
                             <Trash className="w-3 h-3 cursor-pointer hover:text-destructive" onClick={() => toggleCreateShift(id)} />
                           </Badge>
                         )
                       })}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Rol Institucional</Label>
                    <Select value={formData.role} onValueChange={(val: UserRole) => updateCreateField('role', val)}>
                      <SelectTrigger className="h-14 rounded-2xl font-black text-primary border-primary/20 bg-primary/5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="docent" className="font-bold py-3">Docente</SelectItem>
                        <SelectItem value="secretary" className="font-bold py-3">Secretaría</SelectItem>
                        <SelectItem value="coordinator" className="font-bold py-3">Coordinador</SelectItem>
                        <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button type="submit" className="w-full h-16 rounded-2xl font-black text-lg shadow-xl" disabled={isCreating}>
                    {isCreating ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6 mr-2" />}
                    Confirmar Registro
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-10 border-b p-10">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, correo o cédula..." 
              className="pl-12 h-14 border-gray-200 rounded-2xl shadow-sm bg-white" 
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
                  <th className="px-10 py-8">Miembro</th>
                  <th className="px-10 py-8">Sede / Programa</th>
                  <th className="px-10 py-8">Rol</th>
                  <th className="px-10 py-8 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr><td colSpan={4} className="py-40 text-center"><Loader2 className="w-16 h-16 animate-spin mx-auto text-primary opacity-20" /></td></tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50/50 transition-all group">
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-6">
                          <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg", u.role === 'admin' ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-lg text-gray-800">{u.name}</div>
                            <div className="text-xs text-muted-foreground font-bold">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase"><MapPin className="w-3.5 h-3.5" /> {u.campus || 'Sin Sede'}</div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase"><BookOpen className="w-3.5 h-3.5" /> {u.program || 'Sin Programa'}</div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <Select disabled={updatingId === u.id} onValueChange={(val) => handleRoleChange(u.id, val as UserRole, u.email)} value={u.role || 'docent'}>
                          <SelectTrigger className="w-48 h-12 rounded-xl text-xs font-black bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="docent" className="font-bold py-3">Docente</SelectItem>
                            <SelectItem value="secretary" className="font-bold py-3">Secretaría</SelectItem>
                            <SelectItem value="coordinator" className="font-bold py-3">Coordinador</SelectItem>
                            <SelectItem value="admin" className="font-bold py-3 text-primary">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl h-12 w-12" onClick={() => handleDeleteUser(u.id)}>
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
