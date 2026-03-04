
"use client"

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserIcon, Loader2, Save, Camera, Upload, CreditCard, ArrowRight } from 'lucide-react';
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

  // Consultas memoizadas para prevenir Quota Exceeded
  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campuses } = useCollection<Campus>(campusesQuery);
  const { data: programs } = useCollection<Program>(programsQuery);
  const { data: shifts, loading: shiftsLoading } = useCollection<Shift>(shiftsQuery);

  // Sincronización inicial única por ID de usuario
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
      if (JSON.stringify(prev[field as keyof typeof prev]) === JSON.stringify(value)) return prev;
      return { ...prev, [field]: value };
    });
  }, []);

  const toggleShift = (shiftId: string) => {
    if (saving) return;
    const current = formData.shiftIds || [];
    const newShifts = current.includes(shiftId)
      ? current.filter(id => id !== shiftId)
      : [...current, shiftId];
    updateField('shiftIds', newShifts);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Archivo no válido" });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      updateField('avatarUrl', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user?.id || saving) return;
    
    setSaving(true);
    try {
      const userRef = doc(db, 'userProfiles', user.id);
      await updateDoc(userRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Perfil Sincronizado", description: "Tus datos han sido actualizados correctamente." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo sincronizar con el servidor." });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary opacity-20" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sincronizando Perfil...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Gestiona tu identidad y datos laborales.
          </p>
        </div>
        <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl">
          <Link href="/dashboard/profile/carnet">
            <CreditCard className="w-5 h-5" /> Mi Carnet <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-12 text-center flex flex-col items-center">
             <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
                <div className="w-48 h-48 rounded-[3.5rem] bg-gray-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-2xl relative transition-transform hover:scale-105">
                  {formData.avatarUrl ? (
                    <Image src={formData.avatarUrl} alt={formData.name} width={200} height={200} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <UserIcon className="w-20 h-20 text-gray-200" />
                  )}
                  <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                    <Camera className="w-10 h-10" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cambiar Foto</span>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             </div>
             
             <div className="mt-10 space-y-3">
               <h3 className="text-2xl font-black text-gray-800 line-clamp-2">
                 {formData.name || 'Cargando...'}
               </h3>
               <Badge variant="secondary" className="uppercase font-black text-[10px] tracking-[0.2em] px-5 py-2 rounded-xl border-none">
                 {user?.role || 'docent'}
               </Badge>
             </div>

             <Button 
               variant="ghost" 
               className="mt-8 rounded-2xl font-black gap-2 text-[10px] uppercase h-12 px-8 text-primary hover:bg-primary/5" 
               onClick={() => fileInputRef.current?.click()}
               disabled={saving}
             >
               <Upload className="w-4 h-4" /> Actualizar Foto
             </Button>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
             <form onSubmit={handleSave}>
                <CardHeader className="border-b bg-gray-50/50 p-10">
                   <CardTitle className="text-xl font-black text-gray-800">Información Institucional</CardTitle>
                </CardHeader>
                
                <CardContent className="p-10 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Nombre Completo</Label>
                         <Input 
                           value={formData.name} 
                           onChange={(e) => updateField('name', e.target.value)} 
                           className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold" 
                           placeholder="Nombre completo" 
                           required
                           disabled={saving}
                         />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Documento de Identidad</Label>
                         <Input 
                           value={formData.documentId} 
                           onChange={(e) => updateField('documentId', e.target.value)} 
                           className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold" 
                           placeholder="C.C." 
                           required
                           disabled={saving}
                         />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Sede Principal</Label>
                         <Select 
                           value={formData.campus || "unselected"} 
                           onValueChange={(v) => updateField('campus', v === "unselected" ? "" : v)}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-xs">
                             <SelectValue placeholder="Seleccionar Sede" />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             <SelectItem value="unselected" className="font-bold py-3">Sin Sede</SelectItem>
                             {campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold py-3">{c.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Programa / Cargo</Label>
                         <Select 
                           value={formData.program || "unselected"} 
                           onValueChange={(v) => updateField('program', v === "unselected" ? "" : v)}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-xs">
                             <SelectValue placeholder="Seleccionar Programa" />
                           </SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             <SelectItem value="unselected" className="font-bold py-3">Sin Programa</SelectItem>
                             {programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold py-3">{p.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Jornadas Laborales</Label>
                      {shiftsLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin opacity-20" /></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          {shifts?.map(s => (
                            <div 
                              key={s.id} 
                              onClick={() => toggleShift(s.id)}
                              className={cn(
                                "flex items-center space-x-4 p-5 rounded-3xl border-2 transition-all cursor-pointer",
                                formData.shiftIds?.includes(s.id) ? "bg-primary/5 border-primary shadow-sm" : "bg-white border-gray-100"
                              )}
                            >
                              <Checkbox 
                                checked={formData.shiftIds?.includes(s.id)}
                                className="w-5 h-5 rounded-md border-primary pointer-events-none"
                                onCheckedChange={() => {}}
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-800 uppercase">{s.name}</span>
                                <span className="text-[9px] font-bold text-muted-foreground opacity-70">
                                  {s.startTime} - {s.endTime}
                                </span>
                              </div>
                            </div>
                          ))}
                          {shifts?.length === 0 && (
                            <p className="col-span-full text-center py-6 text-muted-foreground text-xs italic">
                              No hay jornadas institucionales registradas.
                            </p>
                          )}
                        </div>
                      )}
                   </div>
                </CardContent>

                <CardFooter className="bg-gray-50/80 p-10 border-t flex justify-end">
                   <Button type="submit" className="h-16 px-14 rounded-2xl font-black gap-3 shadow-2xl" disabled={saving}>
                     {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
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
