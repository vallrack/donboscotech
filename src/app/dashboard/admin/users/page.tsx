
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, Mail, Loader2, ShieldCheck, 
  ShieldAlert, UserPlus, BookOpen, MapPin, Shield, Trash2, Users
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

  // Consultas de datos institucionales
  const { data: campuses } = useCollection<Campus>(db ? collection(db, 'campuses') : null as any);
  const { data: programs } = useCollection<Program>(db ? collection(db, 'programs') : null as any);
  const { data: shifts } = useCollection<Shift>(db ? collection(db, 'shifts') : null as any);
  
  // CONSULTA TOTAL: Obtenemos toda la colección de perfiles sin filtros para visibilidad completa
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
    
    // Mapeo robusto para asegurar que incluso perfiles vacíos se vean
    const list = (users || []).map(u => ({
      ...u,
      name: u.name || 'Personal sin Nombre',
      email: u.email || 'Sin Correo',
      role: u.role || 'docent',
      id: u.id || (u as any).uid
    }));
    
    // Ordenar alfabéticamente
    list.sort((a, b) => a.name.localeCompare(b.name));
    
    return list.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search) ||
      (u.documentId && u.documentId.toLowerCase().includes(search)) ||
      u.role.toLowerCase().includes(search)
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
    
    // RESTRICCIÓN DE JERARQUÍA: Coordinadores no pueden crear Admins
    if (currentUser?.role === 'coordinator' && formData.role === 'admin') {
      toast({
        variant: "destructive",
        title: "Acción Denegada",
        description: "Los coordinadores no pueden registrar nuevos administradores."
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

      // Sincronización de colecciones de seguridad
      if (formData.role === 'admin') await setDoc(doc(db, 'roles_admins', newUserId), { email: formData.email });
      if (formData.role === 'coordinator') await setDoc(doc(db, 'roles_coordinators', newUserId), { email: formData.email });
      if (formData.role === 'secretary') await setDoc(doc(db, 'roles_secretaries', newUserId), { email: formData.email });

      toast({ title: "Personal Registrado", description: `${formData.name} ahora es parte del sistema.` });
      setIsCreateDialogOpen(false);
      setFormData({ name: '', email: '', password: '', documentId: '', campus: '', program: '', shiftIds: [], role: 'docent' });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error de Registro", description: error.message });
    } finally {
      if (tempApp) await deleteApp(tempApp);
      setIsCreating(false);
    }
  };

  const handleRoleChange = async (userId: string, targetRole: UserRole, userEmail: string, currentRole: string) => {
    if (!db || !userId) return;

    // RESTRICCIÓN DE SEGURIDAD: Coordinadores no pueden tocar a Admins
    if (currentUser?.role === 'coordinator' && (currentRole === 'admin' || targetRole === 'admin')) {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para gestionar roles de administrador." });
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
      
      toast({ title: "Rol Actualizado", description: "El nivel de acceso ha sido modificado." });
    } catch (error) {
      toast({ title: "Error en Actualización", variant: "destructive" });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (userId: string, userRole: string) => {
    if (!db || !userId) return;
    
    if (currentUser?.role === 'coordinator' && userRole === 'admin') {
      toast({ variant: "destructive", title: "Acción Protegida", description: "No puedes eliminar a un administrador." });
      return;
    }

    if (confirm('¿Deseas dar de baja a este miembro del personal? Los registros históricos se mantendrán.')) {
      try {
        await deleteDoc(doc(db, 'userProfiles', userId));
        const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
        for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
        
        toast({ title: "Baja confirmada en el sistema" });
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
          <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
             <ShieldCheck className="w-4 h-4 text-primary" />
             <span className="text-[10px] font-black uppercase tracking-widest">Panel de control de nómina y roles institucionales</span>
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 rounded-2xl font-black gap-2 shadow-2xl shadow-primary/20 hover:scale-105 transition-all">
              <UserPlus className="w-6 h-6" /> Alta de Personal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] rounded-[2.5rem] border-none shadow-2xl overflow-y-auto max-h-[90vh] bg-white">
            <form onSubmit={handleCreateUser}>
              <DialogHeader>
                <DialogTitle className="text-3xl font-black text-primary flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl"><Users className="w-6 h-6 text-primary" /></div>
                  Nuevo Miembro
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                  Registro oficial para carnetización y control de asistencia
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8">
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Nombre Completo</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Cédula / ID</Label><Input value={formData.documentId} onChange={(e) => setFormData({...formData, documentId: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Correo Institucional</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Contraseña Temporal</Label><Input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="h-12 rounded-xl" required /></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Sede Asignada</Label><Select value={formData.campus} onValueChange={(val) => setFormData({...formData, campus: val})}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase tracking-widest">Programa Académico</Label><Select value={formData.program} onValueChange={(val) => setFormData({...formData, program: val})}><SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Asignar Jornadas Laborales</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200">
                    {shifts?.map(s => (
                      <div key={s.id} className="flex items-center space-x-3 bg-white p-4 rounded-2xl border hover:border-primary/20 transition-all">
                        <Checkbox id={`create-shift-${s.id}`} checked={formData.shiftIds.includes(s.id)} onCheckedChange={() => toggleShift(s.id)} />
                        <label htmlFor={`create-shift-${s.id}`} className="text-xs font-bold cursor-pointer">{s.name} <span className="text-[10px] text-muted-foreground">({s.startTime}-{s.endTime})</span></label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest">Nivel de Acceso (Rol)</Label>
                  <Select value={formData.role} onValueChange={(val: UserRole) => setFormData({...formData, role: val})}>
                    <SelectTrigger className="h-12 rounded-xl font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="docent">Docente / Profesor</SelectItem>
                      <SelectItem value="secretary">Secretaría / Auxiliar</SelectItem>
                      <SelectItem value="coordinator">Coordinador de Sede</SelectItem>
                      {currentUser?.role === 'admin' && <SelectItem value="admin">Administrador General</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="bg-gray-50 p-8 border-t rounded-b-[2.5rem]">
                <Button type="submit" className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : "Confirmar Alta en el Sistema"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-8 border-b p-10">
          <div className="relative max-w-2xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, correo, cédula o nivel de acceso..." 
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
                <tr className="bg-gray-50/30 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-10 py-8">Identidad Institucional</th>
                  <th className="px-10 py-8">Sede y Programa</th>
                  <th className="px-10 py-8">Permisos Administrativos</th>
                  <th className="px-10 py-8 text-center">Gestión</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersLoading ? (
                  <tr><td colSpan={4} className="py-32 text-center"><Loader2 className="w-14 h-14 animate-spin mx-auto text-primary opacity-20" /></td></tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isProtectedAdmin = u.role === 'admin' && currentUser?.role === 'coordinator';
                    const isSelf = currentUser?.id === u.id;
                    const isDisabled = updatingId === u.id || isSelf || isProtectedAdmin;

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/50 transition-all group">
                        <td className="px-10 py-8">
                          <div className="flex items-center gap-6">
                            <div className={cn(
                              "w-14 h-14 rounded-[1.25rem] flex items-center justify-center font-black text-xl shadow-lg transition-transform group-hover:scale-110",
                              u.role === 'admin' ? "bg-primary text-white" : "bg-primary/10 text-primary"
                            )}>
                              {u.role === 'admin' ? <Shield className="w-7 h-7" /> : u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-black text-lg flex items-center gap-2 text-gray-800">
                                {u.name}
                                {isProtectedAdmin && <Badge variant="secondary" className="text-[8px] font-black bg-gray-200">PROTEGIDO</Badge>}
                                {isSelf && <Badge className="text-[8px] font-black bg-green-500">YO</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-bold">
                                <Mail className="w-3.5 h-3.5" /> {u.email}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="space-y-2">
                            <div className="text-[10px] font-black uppercase text-gray-500 bg-gray-100 px-3 py-1 rounded-lg inline-flex items-center">
                              <MapPin className="w-3 h-3 mr-2" /> {u.campus || 'Sede sin asignar'}
                            </div>
                            <br/>
                            <div className="text-[10px] font-black uppercase text-primary bg-primary/5 px-3 py-1 rounded-lg inline-flex items-center">
                              <BookOpen className="w-3 h-3 mr-2" /> {u.program || 'Programa sin asignar'}
                            </div>
                            <div className="text-[9px] font-bold text-muted-foreground ml-1">C.C. {u.documentId || 'No registrada'}</div>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <Select 
                            disabled={isDisabled} 
                            onValueChange={(val) => handleRoleChange(u.id, val as UserRole, u.email, u.role)} 
                            value={u.role || 'docent'}
                          >
                            <SelectTrigger className={cn(
                              "w-52 h-11 rounded-xl text-xs font-black shadow-sm",
                              isProtectedAdmin && "opacity-50 border-dashed"
                            )}>
                              {updatingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
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
                            className="text-destructive hover:bg-destructive/10 rounded-xl h-12 w-12"
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
            <div className="py-32 text-center text-muted-foreground italic font-medium flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center"><Search className="w-10 h-10 opacity-20" /></div>
              No se encontraron miembros del personal bajo este criterio.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
