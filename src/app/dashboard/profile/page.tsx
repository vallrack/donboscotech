
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
import { User as UserIcon, Loader2, Save, Camera, CreditCard, ArrowRight, Plus, Trash2, Check, PenTool } from 'lucide-react';
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
  const sigInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    documentId: '',
    campus: '',
    program: '',
    shiftIds: [] as string[],
    avatarUrl: '',
    signatureUrl: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        documentId: user.documentId || '',
        campus: user.campus || '',
        program: user.program || '',
        shiftIds: user.shiftIds || [],
        avatarUrl: user.avatarUrl || '',
        signatureUrl: user.signatureUrl || ''
      });
    }
  }, [user]);

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: shiftsRaw } = useCollection<Shift>(shiftsQuery);

  const campuses = useMemo(() => campusesRaw || [], [campusesRaw]);
  const programs = useMemo(() => programsRaw || [], [programsRaw]);
  const shifts = useMemo(() => shiftsRaw || [], [shiftsRaw]);

  const updateField = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const toggleShift = useCallback((shiftId: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const newShifts = current.includes(shiftId)
        ? current.filter(id => id !== shiftId)
        : [...current, shiftId];
      return { ...prev, shiftIds: newShifts };
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'avatarUrl' | 'signatureUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateField(field, reader.result as string);
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
      toast({ title: "Perfil Sincronizado", description: "Tus datos y firma han sido actualizados." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const assignedShifts = useMemo(() => shifts.filter(s => formData.shiftIds?.includes(s.id)), [shifts, formData.shiftIds]);

  if (authLoading && !user) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin opacity-20" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> 
            Gestión de identidad Ciudad Don Bosco.
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
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-10 text-center flex flex-col items-center">
             <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
                <div className="w-40 h-40 rounded-[3rem] bg-gray-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl relative">
                  {formData.avatarUrl ? (
                    <Image src={formData.avatarUrl} alt="Avatar" width={160} height={160} className="object-cover w-full h-full" unoptimized />
                  ) : (
                    <UserIcon className="w-16 h-16 text-gray-200" />
                  )}
                  <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                    <Camera className="w-8 h-8" />
                    <span className="text-[8px] font-black uppercase">Cambiar Foto</span>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, 'avatarUrl')} className="hidden" accept="image/*" />
             </div>
             <div className="mt-8 space-y-2">
               <h3 className="text-xl font-black text-gray-800">{formData.name || 'Docente'}</h3>
               <Badge variant="secondary" className="uppercase font-black text-[9px] px-4 py-1.5 rounded-xl">
                 {user?.role || 'docent'}
               </Badge>
             </div>
          </Card>

          <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-10 flex flex-col items-center gap-4">
             <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Firma Digital Oficial</h4>
             <div 
               className="w-full aspect-video bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group cursor-pointer" 
               onClick={() => !saving && sigInputRef.current?.click()}
             >
               {formData.signatureUrl ? (
                 <img src={formData.signatureUrl} alt="Firma" className="max-w-full max-h-full object-contain p-4" />
               ) : (
                 <div className="flex flex-col items-center text-muted-foreground/40 gap-2">
                   <PenTool className="w-8 h-8" />
                   <span className="text-[10px] font-bold">Subir Firma Digital</span>
                 </div>
               )}
             </div>
             <input type="file" ref={sigInputRef} onChange={(e) => handleFileChange(e, 'signatureUrl')} className="hidden" accept="image/*" />
             <p className="text-[9px] text-center text-muted-foreground font-medium italic px-4">
               Esta firma validará tus reportes oficiales de asistencia.
             </p>
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
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Nombre Completo</Label>
                       <Input value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="h-14 rounded-2xl bg-gray-50/50 font-bold" required />
                     </div>
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Cédula</Label>
                       <Input value={formData.documentId} onChange={(e) => updateField('documentId', e.target.value)} className="h-14 rounded-2xl bg-gray-50/50 font-bold" required />
                     </div>
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Sede Asignada</Label>
                       <Select 
                        value={formData.campus || ""} 
                        onValueChange={(v) => updateField('campus', v)}
                       >
                        <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold text-left">
                          <SelectValue placeholder="Seleccionar Sede" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {campuses.map(c => <SelectItem key={c.id} value={c.name} className="font-bold">{c.name}</SelectItem>)}
                        </SelectContent>
                       </Select>
                     </div>
                     <div className="space-y-3">
                       <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Programa / Proceso</Label>
                       <Select 
                        value={formData.program || ""} 
                        onValueChange={(v) => updateField('program', v)}
                       >
                        <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold text-left">
                          <SelectValue placeholder="Seleccionar Programa" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {programs.map(p => <SelectItem key={p.id} value={p.name} className="font-bold">{p.name}</SelectItem>)}
                        </SelectContent>
                       </Select>
                     </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-dashed">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Jornadas Laborales</Label>
                    <Select onValueChange={(v) => toggleShift(v)}>
                      <SelectTrigger className="h-16 rounded-3xl bg-primary/5 border-primary/20 font-black text-primary">
                        <div className="flex items-center gap-3">
                          <Plus className="w-5 h-5" />
                          <span>Añadir Jornada</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl shadow-2xl">
                        {shifts.map(s => (
                          <SelectItem key={s.id} value={s.id} className="font-black py-4 border-b last:border-0 border-gray-100">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{s.name}</span>
                                {formData.shiftIds?.includes(s.id) && <Check className="w-3 h-3 text-green-500" />}
                              </div>
                              <span className="text-[10px] font-bold text-muted-foreground">{s.startTime} - {s.endTime}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      {assignedShifts.map(s => (
                        <div key={s.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between group animate-in slide-in-from-bottom-2">
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
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                   </div>
                </CardContent>
                <CardFooter className="bg-gray-50/80 p-10 border-t justify-end">
                  <Button type="submit" className="h-16 px-14 rounded-2xl font-black gap-3 shadow-2xl" disabled={saving}>
                    {saving ? <Loader2 className="animate-spin" /> : <Save className="w-5 h-5" />} 
                    Actualizar Perfil
                  </Button>
                </CardFooter>
             </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
