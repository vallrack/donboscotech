
"use client"

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Loader2, Save, Camera, Upload, CreditCard, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase';
import { Campus, Program, Shift } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: campuses } = useCollection<Campus>(db ? query(collection(db, 'campuses'), orderBy('name')) : null as any);
  const { data: programs } = useCollection<Program>(db ? query(collection(db, 'programs'), orderBy('name')) : null as any);
  const { data: shifts } = useCollection<Shift>(db ? query(collection(db, 'shifts'), orderBy('name')) : null as any);

  const [formData, setFormData] = useState({
    name: '',
    documentId: '',
    campus: '',
    program: '',
    shiftIds: [] as string[],
    avatarUrl: ''
  });

  // Sync formData with user object whenever user object updates from AuthProvider
  useEffect(() => {
    if (user && !saving) {
      setFormData({
        name: user.name || '',
        documentId: user.documentId || '',
        campus: user.campus || '',
        program: user.program || '',
        shiftIds: user.shiftIds || [],
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user, saving]);

  const toggleShift = (shiftId: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      const newShifts = current.includes(shiftId)
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

    if (file.size > 800 * 1024) {
      toast({ 
        variant: "destructive", 
        title: "Imagen muy grande", 
        description: "Intente con una imagen menor a 800KB." 
      });
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
        shiftIds: formData.shiftIds,
        avatarUrl: formData.avatarUrl,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, payload);
      toast({ title: "Perfil Actualizado", description: "Los cambios se guardaron correctamente." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: "No se pudo conectar con el servidor." });
    } finally {
      // Ensure state is released
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium">Gestiona tu identidad y datos laborales.</p>
        </div>
        <Button asChild size="lg" className="h-14 px-8 rounded-2xl font-black gap-2 shadow-xl">
          <Link href="/dashboard/profile/carnet">
            <CreditCard className="w-5 h-5" /> Ver Mi Carnet <ArrowRight className="w-4 h-4 ml-2" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col items-center p-10 h-fit">
           <div className="relative group cursor-pointer" onClick={() => !saving && fileInputRef.current?.click()}>
              <div className="w-40 h-40 rounded-[2.5rem] bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl relative">
                {formData.avatarUrl ? (
                  <Image src={formData.avatarUrl} alt={formData.name} width={160} height={160} className="object-cover w-full h-full" unoptimized />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2">
                  <Camera className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase">Cambiar Foto</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
           </div>
           <div className="mt-8 text-center">
             <h3 className="text-xl font-black text-gray-800">{formData.name || 'Cargando...'}</h3>
             <Badge variant="outline" className="mt-2 uppercase font-black text-[10px] tracking-widest text-primary bg-primary/5 border-primary/20">
               {user.role}
             </Badge>
           </div>
           <Button 
             variant="outline" 
             size="sm" 
             className="mt-6 rounded-xl font-bold gap-2 text-[10px] uppercase h-10 px-6" 
             onClick={() => fileInputRef.current?.click()}
             disabled={saving}
           >
             <Upload className="w-3 h-3" /> Subir desde dispositivo
           </Button>
        </Card>

        <Card className="md:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
           <form onSubmit={handleSave}>
              <CardHeader className="border-b bg-gray-50/30 p-8">
                 <CardTitle className="text-lg font-black">Información Institucional</CardTitle>
                 <CardDescription className="text-xs font-bold text-muted-foreground">Datos requeridos para el carnet oficial de Ciudad Don Bosco.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre Completo</Label>
                    <Input 
                      value={formData.name} 
                      onChange={(e) => setFormData({...formData, name: e.target.value})} 
                      className="h-12 rounded-xl" 
                      placeholder="Juan Bosco" 
                      required
                      disabled={saving}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Documento de Identidad</Label>
                    <Input 
                      value={formData.documentId} 
                      onChange={(e) => setFormData({...formData, documentId: e.target.value})} 
                      className="h-12 rounded-xl" 
                      placeholder="C.C. 123.456.789" 
                      required
                      disabled={saving}
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sede Asignada</Label>
                    <Select 
                      value={formData.campus} 
                      onValueChange={(v) => setFormData({...formData, campus: v})}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                      <SelectContent>
                        {campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Programa / Carrera</Label>
                    <Select 
                      value={formData.program} 
                      onValueChange={(v) => setFormData({...formData, program: v})}
                      disabled={saving}
                    >
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                      <SelectContent>
                        {programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jornadas Laborales (Varias permitidas)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200">
                      {shifts?.map(s => (
                        <div key={s.id} className="flex items-center space-x-3 bg-white p-4 rounded-2xl border shadow-sm hover:border-primary/30 transition-colors">
                          <Checkbox 
                            id={`profile-shift-${s.id}`} 
                            checked={formData.shiftIds?.includes(s.id)}
                            onCheckedChange={() => toggleShift(s.id)}
                            className="w-5 h-5"
                            disabled={saving}
                          />
                          <label htmlFor={`profile-shift-${s.id}`} className="text-xs font-black cursor-pointer leading-tight">
                            {s.name} <br/>
                            <span className="text-[10px] text-muted-foreground font-bold">{s.startTime} - {s.endTime}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                 </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 p-8 border-t flex justify-between items-center">
                 <p className="text-[10px] font-bold text-muted-foreground max-w-[250px]">
                   Al guardar, tus cambios se sincronizarán con la terminal institucional.
                 </p>
                 <Button type="submit" className="h-12 px-10 rounded-2xl font-black gap-2 shadow-lg" disabled={saving}>
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                   Sincronizar Perfil
                 </Button>
              </CardFooter>
           </form>
        </Card>
      </div>
    </div>
  );
}
