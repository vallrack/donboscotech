"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserIcon, Loader2, Save, Camera, CreditCard, ArrowRight, Plus, Trash2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase';
import { Campus, Program, Shift } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSyncedUserId = useRef<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    documentId: '',
    campus: '',
    program: '',
    shiftIds: [] as string[],
    avatarUrl: ''
  });

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: shiftsRaw } = useCollection<Shift>(shiftsQuery);

  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const shifts = useMemo(() => shiftsRaw || [], [shiftsRaw]);

  useEffect(() => {
    if (user && lastSyncedUserId.current !== user.id) {
      setFormData({
        name: user.name || '',
        documentId: user.documentId || '',
        campus: user.campus || '',
        program: user.program || '',
        shiftIds: user.shiftIds || [],
        avatarUrl: user.avatarUrl || ''
      });
      lastSyncedUserId.current = user.id;
    }
  }, [user]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => {
      if (prev[field as keyof typeof prev] === value) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const toggleShift = useCallback((shiftId: string) => {
    if (saving) return;
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const newShifts = current.includes(shiftId)
        ? current.filter(id => id !== shiftId)
        : [...current, shiftId];
      return { ...prev, shiftIds: newShifts };
    });
  }, [saving]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateField('avatarUrl', reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user?.id || saving) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'userProfiles', user.id), {
        ...formData,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Perfil Sincronizado" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const assignedShifts = useMemo(() => {
    return shifts.filter(s => formData.shiftIds?.includes(s.id));
  }, [shifts, formData.shiftIds]);

  if (authLoading && !user) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin opacity-20" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Gestión de identidad Don Bosco.
          </p>
        </div>
        <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl">
          <Link href="/dashboard/profile/carnet">
            <CreditCard className="w-5 h-5" /> Mi Carnet <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-12 text-center flex flex-col items-center h-full">
             <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
                <div className="w-48 h-48 rounded-[3.5rem] bg-gray-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-2xl relative transition-transform hover:scale-105">
                  {formData.avatarUrl ? (
                    <Image src={formData.avatarUrl} alt={formData.name} width={200} height={200} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <UserIcon className="w-20 h-20 text-gray-200" />
                  )}
                  <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                    <Camera className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase">Cambiar Foto</span>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             </div>
             
             <div className="mt-10 space-y-3">
               <h3 className="text-2xl font-black text-gray-800 line-clamp-2">{formData.name || 'Cargando...'}</h3>
               <Badge variant="secondary" className="uppercase font-black text-[10px] px-5 py-2 rounded-xl">
                 {user?.role || 'docent'}
               </Badge>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
             <form onSubmit={handleSave}>
                <CardHeader className="border-b bg-gray-50/50 p-10">
                  <CardTitle className="text-xl font-black">Información Institucional</CardTitle>
                </CardHeader>
                
                <CardContent className="p-10 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Nombre Completo</Label>
                         <Input 
                           value={formData.name} 
                           onChange={(e) => updateField('name', e.target.value)}
                           className="h-14 rounded-2xl bg-gray-50/50 font-bold" 
                           required 
                         />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Documento de Identidad</Label>
                         <Input 
                           value={formData.documentId} 
                           onChange={(e) => updateField('documentId', e.target.value)}
                           className="h-14 rounded-2xl bg-gray-50/50 font-bold" 
                           required 
                         />
                      </div>
                      
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Sede Principal</Label>
                         <Select 
                           value={formData.campus || undefined} 
                           onValueChange={(v) => updateField('campus', v)}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold text-xs">
                             <SelectValue placeholder="Seleccionar Sede" />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             {campuses?.map(c => (
                               <SelectItem key={c.id} value={c.name} className="font-bold py-3">{c.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      </div>

                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Programa / Cargo</Label>
                         <Select 
                           value={formData.program || undefined} 
                           onValueChange={(v) => updateField('program', v)}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold text-xs">
                             <SelectValue placeholder="Seleccionar Programa" />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             {programs?.map(p => (
                               <SelectItem key={p.id} value={p.name} className="font-bold py-3">{p.name}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Asignación de Jornadas Laborales</Label>
                      <div className="space-y-4">
                        <Select 
                          onValueChange={(v) => toggleShift(v)}
                          disabled={saving}
                        >
                          <SelectTrigger className="h-16 rounded-3xl bg-primary/5 border-primary/20 font-black text-sm text-primary">
                            <div className="flex items-center gap-3">
                              <Plus className="w-5 h-5" />
                              <span>Añadir Jornada a mi Horario</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent className="rounded-[2rem] border-none shadow-2xl p-4">
                            {shifts?.map(s => (
                              <SelectItem key={s.id} value={s.id} className="font-black py-4 border-b last:border-0 border-gray-100">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="uppercase tracking-tight">{s.name}</span>
                                    {formData.shiftIds?.includes(s.id) && <Check className="w-3 h-3 text-green-500" />}
                                  </div>
                                  <span className="text-[10px] font-bold text-muted-foreground opacity-60">{s.startTime} - {s.endTime} • {s.days?.join(', ')}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                           {assignedShifts.map(s => (
                             <div key={s.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group">
                                <div>
                                   <p className="text-[10px] font-black text-primary uppercase">{s.name}</p>
                                   <p className="text-[9px] font-bold text-muted-foreground">{s.startTime} - {s.endTime}</p>
                                </div>
                                <Button 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => toggleShift(s.id)}
                                  disabled={saving}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                             </div>
                           ))}
                        </div>
                      </div>
                   </div>
                </CardContent>
                
                <CardFooter className="bg-gray-50/80 p-10 border-t justify-end">
                   <Button 
                     type="submit" 
                     className="h-16 px-14 rounded-2xl font-black gap-3 shadow-2xl" 
                     disabled={saving}
                   >
                     {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} 
                     Sincronizar Mi Perfil
                   </Button>
                </CardFooter>
             </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
