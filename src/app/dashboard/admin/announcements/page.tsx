
"use client"

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Megaphone, PlusCircle, Trash2, Edit3, Loader2, Save, X, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Announcement } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AnnouncementManagementPage() {
  const { user } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'normal' as 'high' | 'normal',
    status: 'active' as 'active' | 'inactive'
  });

  const announcementsQuery = useMemoFirebase(() => 
    db ? query(collection(db, 'announcements'), orderBy('createdAt', 'desc')) : null, 
    [db]
  );
  
  const { data: announcements, loading } = useCollection<Announcement>(announcementsQuery as any);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user || saving) return;

    setSaving(true);
    try {
      const id = editingId || Math.random().toString(36).substring(2, 11);
      const docRef = doc(db, 'announcements', id);
      
      const payload = {
        ...formData,
        updatedAt: serverTimestamp(),
        authorName: user.name,
      };

      if (!editingId) {
        (payload as any).createdAt = serverTimestamp();
        (payload as any).createdBy = user.id;
        await setDoc(docRef, payload);
      } else {
        await updateDoc(docRef, payload);
      }

      toast({ title: editingId ? "Actualizado" : "Publicado" });
      setEditingId(null);
      setFormData({ title: '', content: '', priority: 'normal', status: 'active' });
    } catch (error) {
      toast({ variant: "destructive", title: "Error" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setFormData({ title: ann.title, content: ann.content, priority: ann.priority, status: ann.status });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm('¿Eliminar anuncio?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  if (!user || (user.role === 'docent')) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-4xl font-black text-primary tracking-tighter">Comunicación Institucional</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-5 border-none shadow-2xl rounded-[2.5rem] bg-white h-fit sticky top-24">
          <form onSubmit={handleSave}>
            <CardHeader className="bg-gray-50/50 p-8 border-b">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                {editingId ? <Edit3 className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                {editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Título</Label><Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="h-12 bg-gray-50 font-bold" required /></div>
              <div className="space-y-2"><Label className="text-[10px] font-black uppercase">Mensaje</Label><Textarea value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} className="min-h-[150px] bg-gray-50 font-bold" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <Select value={formData.priority} onValueChange={(val: any) => setFormData({...formData, priority: val})}>
                  <SelectTrigger className="h-12 bg-gray-50 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">Importante</SelectItem></SelectContent>
                </Select>
                <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                  <SelectTrigger className="h-12 bg-gray-50 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Visible</SelectItem><SelectItem value="inactive">Oculto</SelectItem></SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50/50 p-8 border-t flex gap-3">
              <Button type="submit" className="flex-1 h-14 rounded-2xl font-black gap-2 shadow-lg" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {editingId ? 'Guardar Cambios' : 'Publicar Aviso'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-black text-gray-800 ml-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" /> Historial de Comunicaciones
          </h2>
          <Card className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden">
             <ScrollArea className="h-[750px] w-full">
                <div className="p-8 space-y-6">
                  {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin opacity-20" /></div>
                  ) : announcements && announcements.length > 0 ? (
                    announcements.map(ann => (
                      <Card key={ann.id} className={cn("border-none shadow-md rounded-[2rem] bg-white border border-gray-50", ann.status === 'inactive' && "opacity-60 grayscale")}>
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-3 flex-1">
                              <Badge className={cn("text-[8px] font-black px-3 py-1", ann.priority === 'high' ? "bg-red-500" : "bg-primary")}>{ann.priority === 'high' ? 'IMPORTANTE' : 'ESTÁNDAR'}</Badge>
                              <h3 className="text-lg font-black text-gray-800">{ann.title}</h3>
                              <p className="text-sm text-muted-foreground line-clamp-2">{ann.content}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(ann)}><Edit3 className="w-4 h-4 text-primary" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(ann.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <div className="py-20 text-center text-muted-foreground font-black opacity-20 italic">No hay registros.</div>
                  )}
                </div>
             </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
}
