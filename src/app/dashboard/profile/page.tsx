
"use client"

import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User as UserIcon, Loader2, Save, Camera, Upload, CreditCard, ArrowRight, ShieldCheck } from 'lucide-react';
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

  // Consultas memoizadas para prevenir Quota Exceeded
  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campuses } = useCollection<Campus>(campusesQuery);
  const { data: programs } = useCollection<Program>(programsQuery);
  const { data: shifts, loading: shiftsLoading } = useCollection<Shift>(shiftsQuery);

  const [formData, setFormData] = useState({
    name: '',
    documentId: '',
    campus: '',
    program: '',
    shiftIds: [] as string[],
    avatarUrl: ''
  });

  // Estabilización de la sincronización de datos para evitar bucles infinitos
  useEffect(() => {
    if (user) {
      setFormData(prev => {
        const newData = {
          name: user.name || '',
          documentId: user.documentId || '',
          campus: user.campus || '',
          program: user.program || '',
          shiftIds: user.shiftIds || [],
          avatarUrl: user.avatarUrl || ''
        };
        
        // Solo actualizar si hay cambios reales en los valores
        if (JSON.stringify(prev) === JSON.stringify(newData)) {
          return prev;
        }
        return newData;
      });
    }
  }, [user]);

  const toggleShift = (shiftId: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const isAlreadySelected = current.includes(shiftId);
      const newShifts = isAlreadySelected
        ? current.filter(id => id !== shiftId)
        : [...current, shiftId];
      
      return { ...prev, shiftIds: newShifts };
    });
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
      const base64 = reader.result as string;
      setFormData(prev => ({ ...prev, avatarUrl: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user?.id || saving) return;
    
    setSaving(true);
    try {
      const userRef = doc(db, 'userProfiles', user.id);
      const payload = {
        name: formData.name,
        documentId: formData.documentId,
        campus: formData.campus,
        program: formData.program,
        shiftIds: formData.shiftIds || [],
        avatarUrl: formData.avatarUrl,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, payload);
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
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Sincronizando Perfil...</p>
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
            Gestiona tu identidad y datos laborales en tiempo real.
          </p>
        </div>
        <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl hover:scale-105 transition-all">
          <Link href="/dashboard/profile/carnet">
            <CreditCard className="w-5 h-5" /> Ver Mi Carnet <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden flex flex-col items-center p-12 text-center">
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
               <h3 className="text-2xl font-black text-gray-800 leading-tight">
                 {user?.name || 'Nombre no asignado'}
               </h3>
               <div className="flex flex-col items-center gap-2">
                 <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'} className="uppercase font-black text-[10px] tracking-[0.2em] px-5 py-2 rounded-xl border-none shadow-sm">
                   {user?.role === 'admin' && <ShieldCheck className="w-3.5 h-3.5 mr-2" />}
                   {user?.role === 'admin' ? 'Administrador' : user?.role === 'coordinator' ? 'Coordinador' : user?.role === 'secretary' ? 'Secretaría' : 'Docente'}
                 </Badge>
                 <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">Rol de Sistema</span>
               </div>
             </div>

             <Button 
               variant="ghost" 
               className="mt-8 rounded-2xl font-black gap-2 text-[10px] uppercase h-12 px-8 text-primary hover:bg-primary/5 transition-colors" 
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
                   <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-2">Registros oficiales de Ciudad Don Bosco</CardDescription>
                </CardHeader>
                
                <CardContent className="p-10 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Nombre Completo</Label>
                         <Input 
                           value={formData.name} 
                           onChange={(e) => setFormData({...formData, name: e.target.value})} 
                           className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-sm focus:bg-white transition-all" 
                           placeholder="Ingresa tu nombre oficial" 
                           required
                           disabled={saving}
                         />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Documento de Identidad</Label>
                         <Input 
                           value={formData.documentId} 
                           onChange={(e) => setFormData({...formData, documentId: e.target.value})} 
                           className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-sm focus:bg-white transition-all" 
                           placeholder="Número de C.C." 
                           required
                           disabled={saving}
                         />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Sede Principal</Label>
                         <Select 
                           value={formData.campus} 
                           onValueChange={(v) => {
                             if (v !== formData.campus) setFormData({...formData, campus: v});
                           }}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-xs"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             {campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold py-3 rounded-xl">{c.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Programa / Cargo</Label>
                         <Select 
                           value={formData.program} 
                           onValueChange={(v) => {
                             if (v !== formData.program) setFormData({...formData, program: v});
                           }}
                           disabled={saving}
                         >
                           <SelectTrigger className="h-14 rounded-2xl border-gray-100 bg-gray-50/50 font-bold text-xs"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                           <SelectContent className="rounded-2xl border-none shadow-2xl p-2">
                             {programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold py-3 rounded-xl">{p.name}</SelectItem>)}
                           </SelectContent>
                         </Select>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Jornadas de Marcaje Asignadas</Label>
                      {shiftsLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin opacity-20" /></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                          {shifts?.map(s => (
                            <div 
                              key={s.id} 
                              onClick={(e) => {
                                e.preventDefault();
                                if (!saving) toggleShift(s.id);
                              }}
                              className={cn(
                                "flex items-center space-x-4 p-5 rounded-3xl border-2 transition-all cursor-pointer",
                                formData.shiftIds?.includes(s.id) 
                                  ? "bg-primary/5 border-primary shadow-sm" 
                                  : "bg-white border-gray-100 hover:border-gray-200"
                              )}
                            >
                              <Checkbox 
                                id={`profile-shift-${s.id}`} 
                                checked={formData.shiftIds?.includes(s.id)}
                                className="w-5 h-5 rounded-md border-primary pointer-events-none"
                                disabled={saving}
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-800">{s.name}</span>
                                <span className="text-[9px] text-muted-foreground font-black uppercase tracking-tighter opacity-70">
                                  {s.startTime} - {s.endTime}
                                </span>
                                <div className="flex gap-1 mt-1">
                                  {s.days?.map(d => <span key={d} className="text-[7px] bg-gray-100 px-1 rounded">{d}</span>)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {(!shifts || shifts.length === 0) && (
                            <p className="col-span-2 text-center p-8 text-xs font-bold text-muted-foreground opacity-30 uppercase tracking-widest">No hay jornadas configuradas</p>
                          )}
                        </div>
                      )}
                   </div>
                </CardContent>

                <CardFooter className="bg-gray-50/80 p-10 border-t flex flex-col sm:flex-row justify-between items-center gap-6">
                   <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.15em]">
                      <ShieldCheck className="w-5 h-5 text-primary opacity-40" />
                      Protocolo Don Bosco Track Sincronizado
                   </div>
                   <Button type="submit" className="w-full sm:w-auto h-16 px-14 rounded-2xl font-black gap-3 shadow-2xl hover:scale-105 active:scale-95 transition-all" disabled={saving}>
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
