"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campusesRaw } = useCollection<Campus>(campusesQuery);
  const { data: programsRaw } = useCollection<Program>(programsQuery);
  const { data: shiftsRaw, loading: shiftsLoading } = useCollection<Shift>(shiftsQuery);

  // Estabilizar referencias para evitar remontado de Selects
  const campuses = useMemo(() => campusesRaw, [campusesRaw]);
  const programs = useMemo(() => programsRaw, [programsRaw]);
  const shifts = useMemo(() => shiftsRaw, [shiftsRaw]);

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
      await updateDoc(doc(db, 'userProfiles', user.id), { ...formData, updatedAt: new Date().toISOString() });
      toast({ title: "Perfil Sincronizado" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading && !user) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin opacity-20" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /> Gestiona tu identidad laboral.
          </p>
        </div>
        <Button asChild size="lg" className="h-14 px-10 rounded-2xl font-black gap-2 shadow-2xl">
          <Link href="/dashboard/profile/carnet"><CreditCard className="w-5 h-5" /> Mi Carnet <ArrowRight className="w-4 h-4" /></Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white p-12 text-center flex flex-col items-center">
             <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
                <div className="w-48 h-48 rounded-[3.5rem] bg-gray-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-2xl relative transition-transform hover:scale-105">
                  {formData.avatarUrl ? (
                    <Image src={formData.avatarUrl} alt={formData.name} width={200} height={200} className="object-cover w-full h-full" unoptimized />
                  ) : <UserIcon className="w-20 h-20 text-gray-200" />}
                  <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                    <Camera className="w-10 h-10" /> <span className="text-[10px] font-black uppercase">Cambiar Foto</span>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
             </div>
             <div className="mt-10 space-y-3">
               <h3 className="text-2xl font-black text-gray-800 line-clamp-2">{formData.name || 'Cargando...'}</h3>
               <Badge variant="secondary" className="uppercase font-black text-[10px] px-5 py-2 rounded-xl">{user?.role || 'docent'}</Badge>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-8">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden">
             <form onSubmit={handleSave}>
                <CardHeader className="border-b bg-gray-50/50 p-10"><CardTitle className="text-xl font-black">Información Institucional</CardTitle></CardHeader>
                <CardContent className="p-10 space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Nombre Completo</Label>
                         <Input value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="h-14 rounded-2xl bg-gray-50/50 font-bold" required disabled={saving} />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Documento de Identidad</Label>
                         <Input value={formData.documentId} onChange={(e) => updateField('documentId', e.target.value)} className="h-14 rounded-2xl bg-gray-50/50 font-bold" required disabled={saving} />
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Sede Principal</Label>
                         <Select value={formData.campus} onValueChange={(v) => updateField('campus', v)} disabled={saving}>
                           <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                           <SelectContent>{campuses?.map(c => <SelectItem key={c.id} value={c.name} className="font-bold py-3">{c.name}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                      <div className="space-y-3">
                         <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Programa / Cargo</Label>
                         <Select value={formData.program} onValueChange={(v) => updateField('program', v)} disabled={saving}>
                           <SelectTrigger className="h-14 rounded-2xl bg-gray-50/50 font-bold"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                           <SelectContent>{programs?.map(p => <SelectItem key={p.id} value={p.name} className="font-bold py-3">{p.name}</SelectItem>)}</SelectContent>
                         </Select>
                      </div>
                   </div>
                   <div className="space-y-4 pt-4">
                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] ml-1">Jornadas Laborales</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {shifts?.map(s => (
                          <div key={s.id} onClick={() => toggleShift(s.id)} className={cn("flex items-center space-x-4 p-5 rounded-3xl border-2 transition-all cursor-pointer", formData.shiftIds?.includes(s.id) ? "bg-primary/5 border-primary" : "bg-white border-gray-100")}>
                            <Checkbox checked={formData.shiftIds?.includes(s.id)} onCheckedChange={() => {}} className="pointer-events-none" />
                            <div className="flex flex-col"><span className="text-xs font-black uppercase">{s.name}</span><span className="text-[9px] font-bold opacity-70">{s.startTime} - {s.endTime}</span></div>
                          </div>
                        ))}
                      </div>
                   </div>
                </CardContent>
                <CardFooter className="bg-gray-50/80 p-10 border-t justify-end">
                   <Button type="submit" className="h-16 px-14 rounded-2xl font-black gap-3 shadow-2xl" disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Sincronizar Mi Perfil</Button>
                </CardFooter>
             </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
