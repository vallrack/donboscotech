
"use client"

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Mail, Shield, BookOpen, Building2, Clock, Contact, Loader2, Save, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection } from '@/firebase';
import { Campus, Program, Shift } from '@/lib/types';
import Image from 'next/image';

export default function ProfilePage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Selector data
  const { data: campuses } = useCollection<Campus>(db ? query(collection(db, 'campuses'), orderBy('name')) : null as any);
  const { data: programs } = useCollection<Program>(db ? query(collection(db, 'programs'), orderBy('name')) : null as any);
  const { data: shifts } = useCollection<Shift>(db ? query(collection(db, 'shifts'), orderBy('name')) : null as any);

  const [formData, setFormData] = useState({
    name: '',
    documentId: '',
    campus: '',
    program: '',
    shiftId: '',
    avatarUrl: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        documentId: user.documentId || '',
        campus: user.campus || '',
        program: user.program || '',
        shiftId: user.shiftId || '',
        avatarUrl: user.avatarUrl || ''
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user?.id) return;
    
    setSaving(true);
    try {
      await updateDoc(doc(db, 'userProfiles', user.id), formData);
      toast({ title: "Perfil Actualizado", description: "Tu información institucional ha sido guardada." });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudieron guardar los cambios." });
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Mi Perfil Institucional</h1>
          <p className="text-muted-foreground font-medium">Gestiona tu identidad y datos laborales dentro de Ciudad Don Bosco.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Avatar Card */}
        <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden flex flex-col items-center p-10 h-fit">
           <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] bg-gray-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-xl">
                {formData.avatarUrl ? (
                  <Image src={formData.avatarUrl} alt={formData.name} width={160} height={160} className="object-cover" />
                ) : (
                  <User className="w-16 h-16 text-gray-300" />
                )}
              </div>
           </div>
           <div className="mt-8 text-center">
             <h3 className="text-xl font-black text-gray-800">{formData.name}</h3>
             <Badge variant="outline" className="mt-2 uppercase font-black text-[10px] tracking-widest text-primary bg-primary/5 border-primary/20">
               {user.role}
             </Badge>
             <div className="mt-4 flex flex-col gap-1 text-xs font-medium text-muted-foreground">
               <span className="flex items-center justify-center gap-2"><Mail className="w-3 h-3" /> {user.email}</span>
               <span className="flex items-center justify-center gap-2"><Contact className="w-3 h-3" /> ID: {formData.documentId || 'No asignado'}</span>
             </div>
           </div>
        </Card>

        {/* Form Card */}
        <Card className="md:col-span-2 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
           <form onSubmit={handleSave}>
              <CardHeader className="border-b bg-gray-50/30 p-8">
                 <CardTitle className="text-lg font-black">Información del Sistema</CardTitle>
                 <CardDescription>Estos datos aparecerán en tu carnet institucional.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Documento de Identidad</Label>
                    <div className="relative">
                      <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={formData.documentId} 
                        onChange={(e) => setFormData({...formData, documentId: e.target.value})}
                        className="pl-10 h-12 rounded-xl border-gray-100"
                        placeholder="C.C. 123.456.789"
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL de Foto (Avatar)</Label>
                    <div className="relative">
                      <ImageIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        value={formData.avatarUrl} 
                        onChange={(e) => setFormData({...formData, avatarUrl: e.target.value})}
                        className="pl-10 h-12 rounded-xl border-gray-100"
                        placeholder="https://ejemplo.com/foto.jpg"
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Sede Asignada</Label>
                    <Select value={formData.campus} onValueChange={(v) => setFormData({...formData, campus: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-100">
                        <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Seleccionar Sede" />
                      </SelectTrigger>
                      <SelectContent>
                        {campuses?.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Programa / Carrera</Label>
                    <Select value={formData.program} onValueChange={(v) => setFormData({...formData, program: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-100">
                        <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Seleccionar Programa" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs?.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Jornada Laboral</Label>
                    <Select value={formData.shiftId} onValueChange={(v) => setFormData({...formData, shiftId: v})}>
                      <SelectTrigger className="h-12 rounded-xl border-gray-100">
                        <Clock className="w-4 h-4 mr-2 text-muted-foreground" />
                        <SelectValue placeholder="Seleccionar Jornada" />
                      </SelectTrigger>
                      <SelectContent>
                        {shifts?.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.startTime} - {s.endTime})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
              </CardContent>
              <CardFooter className="bg-gray-50/50 p-8 border-t flex justify-end">
                 <Button type="submit" className="h-12 px-10 rounded-2xl font-black gap-2 shadow-lg shadow-primary/20" disabled={saving}>
                   {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                   Guardar Información
                 </Button>
              </CardFooter>
           </form>
        </Card>
      </div>
    </div>
  );
}

