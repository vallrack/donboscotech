
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, BookOpen, Clock, Plus, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Campus, Program, Shift } from '@/lib/types';

export default function SettingsPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const campusesQuery = useMemo(() => db ? query(collection(db, 'campuses'), orderBy('name')) : null, [db]);
  const programsQuery = useMemo(() => db ? query(collection(db, 'programs'), orderBy('name')) : null, [db]);
  const shiftsQuery = useMemo(() => db ? query(collection(db, 'shifts'), orderBy('name')) : null, [db]);

  const { data: campuses } = useCollection<Campus>(campusesQuery as any);
  const { data: programs } = useCollection<Program>(programsQuery as any);
  const { data: shifts } = useCollection<Shift>(shiftsQuery as any);

  const handleAddItem = async (col: string, data: any) => {
    if (!db) return;
    setLoading(true);
    try {
      const id = Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, col, id), data);
      toast({ title: "Guardado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (col: string, id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, col, id));
      toast({ title: "Eliminado" });
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
        <h1 className="text-3xl font-black text-primary">Configuración Institucional</h1>
        <p className="text-muted-foreground">Gestiona sedes, programas académicos y jornadas laborales con acceso total.</p>
      </div>
      <Tabs defaultValue="sedes" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-2xl h-14 bg-gray-100 p-1 rounded-2xl">
          <TabsTrigger value="sedes" className="rounded-xl font-bold"><Building2 className="w-4 h-4 mr-2" /> Sedes</TabsTrigger>
          <TabsTrigger value="programas" className="rounded-xl font-bold"><BookOpen className="w-4 h-4 mr-2" /> Programas</TabsTrigger>
          <TabsTrigger value="jornadas" className="rounded-xl font-bold"><Clock className="w-4 h-4 mr-2" /> Jornadas</TabsTrigger>
        </TabsList>
        <TabsContent value="sedes" className="mt-6">
          <Card className="border-none shadow-xl rounded-3xl">
            <CardHeader><CardTitle>Sedes</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6"><Input id="new-campus" placeholder="Nombre" className="h-12 rounded-xl" /><Button onClick={() => { const el = document.getElementById('new-campus') as HTMLInputElement; if (el.value) handleAddItem('campuses', { name: el.value }); el.value = ''; }} disabled={loading}>Agregar</Button></div>
              <div className="grid gap-3">{campuses?.map(c => (<div key={c.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border"><span className="font-bold">{c.name}</span><Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('campuses', c.id)}><Trash2 className="w-4 h-4" /></Button></div>))}</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="programas" className="mt-6">
          <Card className="border-none shadow-xl rounded-3xl">
            <CardHeader><CardTitle>Programas</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-6"><Input id="new-program" placeholder="Nombre" className="h-12 rounded-xl" /><Button onClick={() => { const el = document.getElementById('new-program') as HTMLInputElement; if (el.value) handleAddItem('programs', { name: el.value, type: 'Technical' }); el.value = ''; }} disabled={loading}>Agregar</Button></div>
              <div className="grid gap-3">{programs?.map(p => (<div key={p.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border"><span className="font-bold">{p.name}</span><Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('programs', p.id)}><Trash2 className="w-4 h-4" /></Button></div>))}</div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="jornadas" className="mt-6">
          <Card className="border-none shadow-xl rounded-3xl">
            <CardHeader><CardTitle>Jornadas</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-6 bg-primary/5 rounded-3xl"><Input id="shift-name" placeholder="Nombre" className="h-12 rounded-xl" /><Input id="shift-start" type="time" className="h-12 rounded-xl" /><Input id="shift-end" type="time" className="h-12 rounded-xl" /><Button className="md:col-span-3" onClick={() => { const name = (document.getElementById('shift-name') as HTMLInputElement).value; const start = (document.getElementById('shift-start') as HTMLInputElement).value; const end = (document.getElementById('shift-end') as HTMLInputElement).value; if (name && start && end) handleAddItem('shifts', { name, startTime: start, endTime: end, days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }); }} disabled={loading}>Configurar</Button></div>
              <div className="grid gap-4">{shifts?.map(s => (<div key={s.id} className="p-5 bg-white rounded-2xl border shadow-sm flex items-center justify-between"><div><p className="font-black">{s.name}</p><p className="text-xs">{s.startTime} - {s.endTime}</p></div><Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete('shifts', s.id)}><Trash2 className="w-4 h-4" /></Button></div>))}</div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
