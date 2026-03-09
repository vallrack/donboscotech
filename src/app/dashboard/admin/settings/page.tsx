
"use client"

import { useState, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Building2, BookOpen, Clock, Trash2, ShieldAlert, Loader2, CalendarCheck, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Campus, Program, Shift } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  
  // States for controlled inputs
  const [newCampusName, setNewCampusName] = useState('');
  const [newProgramName, setNewProgramName] = useState('');
  const [newShift, setNewShift] = useState({
    name: '',
    start: '',
    end: '',
    days: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie']
  });

  const daysOfWeek = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  const campusesQuery = useMemoFirebase(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemoFirebase(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemoFirebase(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campuses, loading: campusesLoading } = useCollection<Campus>(campusesQuery);
  const { data: programs, loading: programsLoading } = useCollection<Program>(programsQuery);
  const { data: shifts, loading: shiftsLoading } = useCollection<Shift>(shiftsQuery);

  const handleAddItem = useCallback((col: string, data: any) => {
    if (!db) return;
    setIsAdding(true);
    const id = Math.random().toString(36).substring(2, 11);
    const docRef = doc(db, col, id);

    setDoc(docRef, data)
      .then(() => {
        toast({ title: "Configuración Guardada", description: "El elemento ha sido añadido satisfactoriamente." });
        if (col === 'campuses') setNewCampusName('');
        if (col === 'programs') setNewProgramName('');
        if (col === 'shifts') setNewShift({ name: '', start: '', end: '', days: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie'] });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'create',
          requestResourceData: data
        } as SecurityRuleContext));
      })
      .finally(() => setIsAdding(false));
  }, [db, toast]);

  const handleDelete = useCallback((col: string, id: string) => {
    if (!db || !confirm('¿Eliminar esta configuración permanentemente?')) return;
    const docRef = doc(db, col, id);

    deleteDoc(docRef)
      .then(() => {
        toast({ title: "Elemento Eliminado" });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        } as SecurityRuleContext));
      });
  }, [db, toast]);

  const toggleDay = (day: string) => {
    setNewShift(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day) 
        : [...prev.days, day]
    }));
  };

  const isPrivileged = user?.role === 'admin' || user?.role === 'coordinator';

  if (!isPrivileged) {
    return (
      <div className="p-12 text-center bg-gray-50 rounded-[3rem] animate-in fade-in duration-500">
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

      <Tabs defaultValue="sedes" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl h-14 bg-gray-100 p-1.5 rounded-2xl shadow-inner">
          <TabsTrigger value="sedes" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Building2 className="w-4 h-4 mr-2" /> Sedes
          </TabsTrigger>
          <TabsTrigger value="programas" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <BookOpen className="w-4 h-4 mr-2" /> Programas
          </TabsTrigger>
          <TabsTrigger value="jornadas" className="rounded-xl font-black text-xs data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
            <Clock className="w-4 h-4 mr-2" /> Jornadas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sedes" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Sedes Ciudad Don Bosco</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ubicaciones físicas de la institución</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <Input 
                  placeholder="Nombre de la nueva sede..." 
                  value={newCampusName}
                  onChange={(e) => setNewCampusName(e.target.value)}
                  className="h-14 rounded-2xl border-none shadow-inner bg-white font-bold" 
                />
                <Button 
                  onClick={() => newCampusName && handleAddItem('campuses', { name: newCampusName })} 
                  disabled={isAdding || !newCampusName} 
                  className="h-14 px-10 rounded-2xl font-black shadow-lg"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
                  Agregar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campusesLoading ? (
                  <div className="col-span-full py-20 text-center opacity-20"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></div>
                ) : (campuses || []).map(c => (
                  <div key={c.id} className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 border-gray-50 shadow-sm hover:border-primary/20 transition-all group">
                    <span className="font-black text-gray-700 text-lg">{c.name}</span>
                    <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete('campuses', c.id)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
                {!campusesLoading && (!campuses || campuses.length === 0) && (
                  <div className="col-span-full py-10 text-center text-muted-foreground italic">No hay sedes registradas.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programas" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Programas Académicos</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Procesos técnicos y educativos</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="flex gap-4 p-6 bg-gray-50 rounded-3xl border border-gray-100">
                <Input 
                  placeholder="Nombre del programa..." 
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  className="h-14 rounded-2xl border-none shadow-inner bg-white font-bold" 
                />
                <Button 
                  onClick={() => newProgramName && handleAddItem('programs', { name: newProgramName, type: 'Technical' })} 
                  disabled={isAdding || !newProgramName} 
                  className="h-14 px-10 rounded-2xl font-black shadow-lg"
                >
                  {isAdding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5 mr-2" />}
                  Agregar
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {programsLoading ? (
                  <div className="col-span-full py-20 text-center opacity-20"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></div>
                ) : (programs || []).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-6 bg-white rounded-3xl border-2 border-gray-50 shadow-sm hover:border-primary/20 transition-all group">
                    <span className="font-black text-gray-700 text-lg">{p.name}</span>
                    <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete('programs', p.id)}>
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                ))}
                {!programsLoading && (!programs || programs.length === 0) && (
                  <div className="col-span-full py-10 text-center text-muted-foreground italic">No hay programas registrados.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jornadas" className="mt-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="p-8 border-b bg-gray-50/50">
              <CardTitle className="text-xl font-black">Jornadas Laborales Oficiales</CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Horarios institucionales permitidos</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <div className="p-8 bg-primary/5 rounded-[3rem] border-2 border-primary/10 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Nombre</Label>
                    <Input 
                      placeholder="Ej: Jornada Mañana" 
                      value={newShift.name}
                      onChange={(e) => setNewShift({...newShift, name: e.target.value})}
                      className="h-14 rounded-2xl border-none shadow-inner bg-white font-bold" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entrada</Label>
                    <Input 
                      type="time" 
                      value={newShift.start}
                      onChange={(e) => setNewShift({...newShift, start: e.target.value})}
                      className="h-14 rounded-2xl border-none shadow-inner bg-white font-bold" 
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Salida</Label>
                    <Input 
                      type="time" 
                      value={newShift.end}
                      onChange={(e) => setNewShift({...newShift, end: e.target.value})}
                      className="h-14 rounded-2xl border-none shadow-inner bg-white font-bold" 
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Días de Aplicación</Label>
                  <div className="flex flex-wrap gap-3">
                    {daysOfWeek.map(day => (
                      <div 
                        key={day} 
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-6 py-2.5 rounded-xl border-2 cursor-pointer font-black text-xs transition-all",
                          newShift.days.includes(day) 
                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full h-16 rounded-3xl font-black text-lg shadow-xl" 
                  onClick={() => {
                    if (newShift.name && newShift.start && newShift.end && newShift.days.length > 0) {
                      handleAddItem('shifts', { 
                        name: newShift.name, 
                        startTime: newShift.start, 
                        endTime: newShift.end, 
                        days: newShift.days 
                      });
                    } else {
                      toast({ variant: "destructive", title: "Datos incompletos", description: "Completa todos los campos." });
                    }
                  }} 
                  disabled={isAdding}
                >
                  <CalendarCheck className="w-6 h-6 mr-2" /> Crear Jornada Oficial
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {shiftsLoading ? (
                  <div className="col-span-full py-20 text-center opacity-20"><Loader2 className="w-10 h-10 animate-spin mx-auto" /></div>
                ) : (shifts || []).map(s => (
                  <div key={s.id} className="p-8 bg-white rounded-[2.5rem] border-2 border-gray-50 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="space-y-2">
                      <p className="font-black text-gray-800 text-xl uppercase tracking-tight">{s.name}</p>
                      <div className="flex items-center gap-2 text-xs font-bold text-primary">
                        <Clock className="w-4 h-4" /> {s.startTime} - {s.endTime}
                      </div>
                      <div className="flex gap-1.5 flex-wrap mt-3">
                        {s.days?.map(d => (
                          <span key={d} className="text-[9px] font-black bg-gray-100 text-gray-500 px-2.5 py-1 rounded-lg uppercase">{d}</span>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity h-12 w-12 rounded-2xl hover:bg-destructive/5" onClick={() => handleDelete('shifts', s.id)}>
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
