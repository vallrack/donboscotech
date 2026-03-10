
"use client"

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, query, orderBy, getDocs, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth as getFirebaseAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, Loader2, ShieldCheck, 
  PlusCircle, MapPin, BookOpen, Trash2, Plus, Trash, Edit3, Save, X as CloseIcon, UserCheck, ShieldAlert, Lock, BellRing, Zap
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
import { sendAttendanceReminder } from '@/ai/flows/attendance-reminder-flow';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isNotifying, setIsNotifying] = useState<string | null>(null);
  const [isGlobalNotifying, setIsGlobalNotifying] = useState(false);
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

  const handleGlobalReminders = async () => {
    if (!db || isGlobalNotifying) return;
    setIsGlobalNotifying(true);
    
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      const [currH, currM] = timeStr.split(':').map(Number);
      const currTotal = currH * 60 + currM;
      const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

      const docents = users.filter(u => u.role === 'docent');
      let sentCount = 0;

      for (const docent of docents) {
        const todayShifts = shifts.filter(s => docent.shiftIds?.includes(s.id) && s.days?.includes(dayName));
        
        for (const s of todayShifts) {
          const [sh, sm] = s.startTime.split(':').map(Number);
          const startT = sh * 60 + sm;
          
          if (currTotal >= (startT - 10) && currTotal <= (startT + 120)) {
            const q = query(
              collection(db, 'userProfiles', docent.id, 'attendanceRecords'), 
              where('date', '==', todayStr),
              where('type', '==', 'entry')
            );
            const snap = await getDocs(q);
            
            if (snap.empty) {
              await sendAttendanceReminder({
                userName: docent.name,
                userEmail: docent.email,
                shiftName: s.name,
                startTime: s.startTime
              });
              sentCount++;
            }
          }
        }
      }

      toast({
        title: "Proceso Completado",
        description: `Se han enviado ${sentCount} recordatorios automáticos.`
      });
    } catch (error) {
      toast({ variant: "destructive", title: "Error en el proceso global" });
    } finally {
      setIsGlobalNotifying(false);
    }
  };

  const handleSendReminder = async (targetUser: User) => {
    if (isNotifying) return;
    setIsNotifying(targetUser.id);
    
    try {
      const firstShiftId = targetUser.shiftIds?.[0];
      const shift = shifts.find(s => s.id === firstShiftId);
      
      const result = await sendAttendanceReminder({
        userName: targetUser.name,
        userEmail: targetUser.email,
        shiftName: shift?.name || 'Jornada Institucional',
        startTime: shift?.startTime || '07:00'
      });

      if (result.success) {
        toast({ title: "Recordatorio Enviado", description: `Se ha notificado a ${targetUser.name} vía correo electrónico.` });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al enviar", description: error.message });
    } finally {
      setIsNotifying(null);
    }
  };

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

      const profileRef = doc(db, 'userProfiles', newUserId);
      await setDoc(profileRef, userProfile);

      if (formData.role !== 'docent') {
        const col = formData.role === 'admin' ? 'roles_admins' : formData.role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
        await setDoc(doc(db, col, newUserId), { email: formData.email, assignedAt: new Date().toISOString() });
      }

      toast({ title: "Personal Registrado" });
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
    if (currentUser?.role === 'coordinator' && u.role === 'admin') {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "Un coordinador no puede modificar perfiles de administrador." });
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
    const profileRef = doc(db, 'userProfiles', editingUser.id);
    const updateData = {
      name: formData.name,
      documentId: formData.documentId,
      campus: formData.campus,
      program: formData.program,
      shiftIds: formData.shiftIds,
      role: formData.role,
      updatedAt: serverTimestamp()
    };
    updateDoc(profileRef, updateData)
      .then(async () => {
        if (formData.role !== editingUser.role) {
          const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
          for (const col of rolesCols) await deleteDoc(doc(db, col, editingUser.id));
          if (formData.role !== 'docent') {
            const col = formData.role === 'admin' ? 'roles_admins' : formData.role === 'coordinator' ? 'roles_coordinators' : 'roles_secretaries';
            await setDoc(doc(db, col, editingUser.id), { email: formData.email, assignedAt: new Date().toISOString() });
          }
        }
        toast({ title: "Perfil actualizado" });
        setIsEditDialogOpen(false);
        resetForm();
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: profileRef.path,
          operation: 'update',
          requestResourceData: updateData
        } as SecurityRuleContext));
      })
      .finally(() => setIsSaving(false));
  };

  const handleDeleteUser = useCallback((userId: string, targetRole?: string) => {
    if (currentUser?.role === 'coordinator' && targetRole === 'admin') {
      toast({ variant: "destructive", title: "Acceso Denegado", description: "No tienes permisos para eliminar a un administrador." });
      return;
    }
    if (!db || !confirm('¿Dar de baja a este miembro permanentemente?')) return;
    const profileRef = doc(db, 'userProfiles', userId);
    deleteDoc(profileRef)
      .then(async () => {
        const rolesCols = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
        for (const col of rolesCols) await deleteDoc(doc(db, col, userId));
        toast({ title: "Personal removido" });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: profileRef.path, operation: 'delete' } as SecurityRuleContext));
      });
  }, [db, currentUser, toast]);

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
          <p className="text-muted-foreground font-medium mt-2">Administra roles y credenciales de Ciudad Don Bosco.</p>
        </div>
        
        <div className="flex flex-wrap gap-4">
          <Button 
            variant="outline" 
            onClick={handleGlobalReminders} 
            disabled={isGlobalNotifying}
            className="h-14 px-8 rounded-2xl font-black gap-2 shadow-xl border-primary/20 text-primary hover:bg-primary/5"
          >
            {isGlobalNotifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
            Ejecutar Recordatorio Global
          </Button>

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
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Cédula</Label>
                        <Input value={formData.documentId} onChange={(e) => updateFormField('documentId', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Correo Institucional</Label>
                        <Input type="email" value={formData.email} onChange={(e) => updateFormField('email', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Contraseña</Label>
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
                        <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa</Label>
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
                      <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nivel de Permisos</Label>
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
                      Confirmar Registro
                    </Button>
                  </div>
                </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={(val) => { setIsEditDialogOpen(val); if(!val) resetForm(); }}>
        <DialogContent className="sm:max-w-[750px] rounded-[3rem] border-none shadow-2xl bg-white p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader className="p-10 pb-0">
            <DialogTitle className="text-2xl font-black text-gray-800">Actualizar Perfil</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-10 pt-4 space-y-8">
            <form onSubmit={handleUpdateUser}>
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Nombre</Label>
                    <Input value={formData.name} onChange={(e) => updateFormField('name', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Cédula</Label>
                    <Input value={formData.documentId} onChange={(e) => updateFormField('documentId', e.target.value)} className="h-12 rounded-xl bg-gray-50/50" required />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Sede</Label>
                    <Select value={formData.campus || undefined} onValueChange={(val) => updateFormField('campus', val)}>
                      <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                      <SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold">{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Programa</Label>
                    <Select value={formData.program || undefined} onValueChange={(val) => updateFormField('program', val)}>
                      <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                      <SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold">{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Jornadas</Label>
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
                  <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 ml-1">Rol</Label>
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
                  Guardar Cambios
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
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase"><MapPin className="w-3.5 h-3.5" /> {u.campus || 'N/A'}</div>
                            <div className="flex items-center gap-2 text-[10px] font-black text-primary uppercase"><BookOpen className="w-3.5 h-3.5" /> {u.program || 'N/A'}</div>
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
                                <Lock className="w-3 h-3" /> Protegido
                              </div>
                            ) : (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-primary hover:bg-primary/5 rounded-xl h-12 w-12" 
                                  onClick={() => handleSendReminder(u)}
                                  disabled={isNotifying === u.id}
                                  title="Enviar Recordatorio"
                                >
                                  {isNotifying === u.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <BellRing className="w-5 h-5" />}
                                </Button>
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
