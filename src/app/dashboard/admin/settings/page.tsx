
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Building2, BookOpen, Clock, Trash2, ShieldAlert, Loader2, CalendarCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Campus, Program, Shift } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [selectedDays, setSelectedDays] = useState<string[]>(['Lun', 'Mar', 'Mie', 'Jue', 'Vie']);
  const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campuses } = useCollection<Campus>(campusesQuery);
  const { data: programs } = useCollection<Program>(programsQuery);
  const { data: shifts } = useCollection<Shift>(shiftsQuery);

  const handleAddItem = async (col: string, data: any) => {
    if (!db) return;
    setLoading(true);
    try {
      const id = Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, col, id), data);
      toast({ title: "Configuración Guardada" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleDelete = async (col: string, id: string) => {
    if (!db || !confirm('¿Eliminar esta configuración permanentemente?')) return;
    try {
      await deleteDoc(doc(db, col, id));
      toast({ title: "Elemento Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const isPrivileged = user?.role === 'admin' || user?.role === 'coordinator';

  if (!isPrivileged) {
    return (
      <div className="p-12 text-center bg-gray-50 rounded-3xl">
        <ShieldAlert className="w-16 h-16 text-destructive mx-auto opacity-20 mb-4" />
        <h2 className="text-2xl font-black text-destructive">Acceso Restringido</h2>
        <p className="text-muted-foreground font-bold">Solo personal administrativo puede configurar el sistema.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black text-primary tracking-tighter">Configuración Institucional</h1>
        <p className="text-muted-foreground font-medium italic">Gestión de infraestructura, academia y jornadas laborales.</p>
      </div>

      <Tabs defaultValue="jornadas" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl h-14 bg-gray-100 p-1 rounded-2xl shadow-inner">
          <TabsTrigger value="sedes" className="rounded-xl font-bold text-xs"><Building2 className="w-4 h-4 mr-2" /> Sedes</TabsTrigger>
          <TabsTrigger value="programas" className="rounded-xl font-bold text-xs"><BookOpen className="w-4 h-4 mr-2" /> Programas</TabsTrigger>
          <TabsTrigger value="jornadas" className="rounded-xl font-bold text-xs"><Clock className="w-4 h-4 mr-2" /> Jornadas</TabsTrigger>
        </TabsList>

        <TabsContent value="sedes" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Sedes Ciudad Don Bosco</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex gap-4 mb-8">
                <Input id="new-campus" placeholder="Nombre de la Sede" className="h-12 rounded-xl border-gray-100 bg-gray-50/50 font-bold" />
                <Button onClick={() => { 
                  const el = document.getElementById('new-campus') as HTMLInputElement; 
                  if (el.value) handleAddItem('campuses', { name: el.value }); 
                  el.value = ''; 
                }} disabled={loading} className="h-12 px-8 rounded-xl font-black">Agregar</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campuses?.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border-2 border-gray-50 shadow-sm hover:border-primary/20 transition-all">
                    <span className="font-black text-gray-700">{c.name}</span>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => handleDelete('campuses', c.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programas" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Programas Académicos</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex gap-4 mb-8">
                <Input id="new-program" placeholder="Nombre del Programa" className="h-12 rounded-xl border-gray-100 bg-gray-50/50 font-bold" />
                <Button onClick={() => { 
                  const el = document.getElementById('new-program') as HTMLInputElement; 
                  if (el.value) handleAddItem('programs', { name: el.value, type: 'Technical' }); 
                  el.value = ''; 
                }} disabled={loading} className="h-12 px-8 rounded-xl font-black">Agregar</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs?.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border-2 border-gray-50 shadow-sm hover:border-primary/20 transition-all">
                    <span className="font-black text-gray-700">{p.name}</span>
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/5" onClick={() => handleDelete('programs', p.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jornadas" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Configuración de Jornadas Laborales</CardTitle>
              <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Define los horarios oficiales de la institución</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="p-8 bg-primary/5 rounded-[2rem] border-2 border-primary/10 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre de la Jornada</Label>
                    <Input id="shift-name" placeholder="Ej: Mañana" className="h-12 rounded-xl border-none shadow-inner font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Hora Inicio</Label>
                    <Input id="shift-start" type="time" className="h-12 rounded-xl border-none shadow-inner font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Hora Fin</Label>
                    <Input id="shift-end" type="time" className="h-12 rounded-xl border-none shadow-inner font-bold" />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Días de Aplicación</Label>
                  <div className="flex flex-wrap gap-3">
                    {daysOfWeek.map(day => (
                      <div 
                        key={day} 
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-6 py-2 rounded-xl border-2 cursor-pointer font-black text-xs transition-all",
                          selectedDays.includes(day) 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>

                <Button className="w-full h-14 rounded-2xl font-black text-lg shadow-xl" onClick={() => { 
                  const name = (document.getElementById('shift-name') as HTMLInputElement).value; 
                  const start = (document.getElementById('shift-start') as HTMLInputElement).value; 
                  const end = (document.getElementById('shift-end') as HTMLInputElement).value; 
                  if (name && start && end && selectedDays.length > 0) {
                    handleAddItem('shifts', { name, startTime: start, endTime: end, days: selectedDays });
                    (document.getElementById('shift-name') as HTMLInputElement).value = '';
                  } else {
                    toast({ variant: "destructive", title: "Datos incompletos", description: "Completa todos los campos y días." });
                  }
                }} disabled={loading}>
                  <CalendarCheck className="w-5 h-5 mr-2" /> Crear Jornada Oficial
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shifts?.map(s => (
                  <div key={s.id} className="p-6 bg-white rounded-3xl border-2 border-gray-50 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="space-y-1">
                      <p className="font-black text-gray-800 text-lg uppercase tracking-tight">{s.name}</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Clock className="w-3.5 h-3.5" /> {s.startTime} - {s.endTime}
                      </div>
                      <div className="flex gap-1 flex-wrap mt-2">
                        {s.days?.map(d => (
                          <span key={d} className="text-[8px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md uppercase">{d}</span>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete('shifts', s.id)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
