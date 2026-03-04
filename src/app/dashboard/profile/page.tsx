
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
import { User, Mail, Shield, BookOpen, Building2, Clock, Contact, Loader2, Save, Image as ImageIcon, Camera, Upload, CreditCard, ArrowRight } from 'lucide-react';
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
  const router = useRouter();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selector data
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

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        documentId: user.documentId || '',
        campus: user.campus || '',
        program: user.program || '',
        shiftIds: user.shiftIds || [],
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user]);

  const toggleShift = (shiftId: string) => {
    setFormData(prev => {
      const current = prev.shiftIds || [];
      if (current.includes(shiftId)) {
        return { ...prev, shiftIds: current.filter(id => id !== shiftId) };
      } else {
        return { ...prev, shiftIds: [...current, shiftId] };
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: "destructive", title: "Archivo no válido" });
      return;
    }

    if (file.size > 1024 * 1024) {
      toast({ variant: "destructive", title: "Imagen muy grande", description: "El límite es 1MB." });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
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
      
      toast({ title: "Perfil Actualizado", description: "Los cambios se han guardado correctamente." });
      router.refresh(); // Force Next.js to refresh data
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ variant: "destructive", title: "Error al guardar", description: "Verifica tu conexión o permisos." });
    } finally {
      // Small delay to ensure DB sync before re-enabling buttons
      setTimeout(() => setSaving(false), 500);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium">Gestiona tu identidad y datos laborales.</p>
        </div>
        <Link href="/dashboard/profile/carnet">
          <Button size="lg" className="h-14 px-8 rounded-2xl font-black gap-2 shadow-xl bg-primary hover:bg-primary/90">
            <CreditCard className="w-5 h-5" /> Ver Mi Carnet <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col items-center p-10 h-fit">
           <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl relative">
                {formData.avatarUrl ? (
                  <Image src={formData.avatarUrl} alt={formData.name} width={160} height={160} className="object-cover w-full h-full" />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2"
                >
                  <Camera className="w-8 h-8" />
                  <span className="text-[10px] font-black uppercase">Cambiar</span>
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
           </div>
           <div className="mt-8 text-center">
             <h3 className="text-xl font-black text-gray-800">{formData.name}</h3>
             <Badge variant="outline" className="mt-2 uppercase font-black text-[10px] tracking-widest text-primary bg-primary/5 border-primary/20">
               {user.role}
             </Badge>
           </div>
           <Button variant="outline" size="sm" className="mt-6 rounded-xl font-bold gap-2 text-[10px] uppercase h-10 px-6" onClick={() => fileInputRef.current?.click()}>
             <Upload className="w-3 h-3" /> Subir Foto
           </Button>
        </Card>

        <Card className="md:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
           <form onSubmit={handleSave}>
              <CardHeader className="border-b bg-gray-50/30 p-8">
                 <CardTitle className="text-lg font-black">Información del Sistema</CardTitle>
                 <CardDescription className="text-xs font-bold">Estos datos aparecen en tu carnet oficial.</CardDescription>
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
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Sede Asignada</Label>
                    <Select value={formData.campus} onValueChange={(v) => setFormData({...formData, campus: v})}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar Sede" /></SelectTrigger>
                      <SelectContent>
                        {campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        {!campuses?.length && <SelectItem value="loading" disabled>Cargando sedes...</SelectItem>}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Programa Académico</Label>
                    <Select value={formData.program} onValueChange={(v) => setFormData({...formData, program: v})}>
                      <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Seleccionar Programa" /></SelectTrigger>
                      <SelectContent>
                        {programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                        {!programs?.length && <SelectItem value="loading" disabled>Cargando programas...</SelectItem>}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Jornadas Institucionales</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200">
                      {shifts?.map(s => (
                        <div key={s.id} className="flex items-center space-x-3 bg-white p-4 rounded-2xl border shadow-sm hover:border-primary/30 transition-colors">
                          <Checkbox 
                            id={`profile-shift-${s.id}`} 
                            checked={formData.shiftIds?.includes(s.id)}
                            onCheckedChange={() => toggleShift(s.id)}
                            className="w-5 h-5"
                          />
                          <label htmlFor={`profile-shift-${s.id}`} className="text-xs font-black cursor-pointer leading-tight">
                            {s.name} <br/>
                            <span className="text-[10px] text-muted-foreground font-bold">{s.startTime} - {s.endTime}</span>
                          </label>
                        </div>
                      ))}
                      {!shifts?.length && <p className="text-xs text-muted-foreground italic p-4">Cargando jornadas...</p>}
                    </div>
                 </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 p-8 border-t flex justify-between items-center">
                 <p className="text-[10px] font-bold text-muted-foreground max-w-[250px]">
                   Asegúrate de que tu información sea verídica para evitar problemas en el registro de asistencia.
                 </p>
                 <Button type="submit" className="h-12 px-10 rounded-2xl font-black gap-2 shadow-lg" disabled={saving}>
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                   Guardar Cambios
                 </Button>
              </CardFooter>
           </form>
        </Card>
      </div>
    </div>
  );
}
