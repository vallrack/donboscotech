
"use client"

import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
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

  const announcementsQuery = db ? query(collection(db, 'announcements'), orderBy('createdAt', 'desc')) : null;
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

      toast({ title: editingId ? "Anuncio Actualizado" : "Anuncio Publicado" });
      setEditingId(null);
      setFormData({ title: '', content: '', priority: 'normal', status: 'active' });
    } catch (error) {
      toast({ variant: "destructive", title: "Error al guardar" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setFormData({
      title: ann.title,
      content: ann.content,
      priority: ann.priority,
      status: ann.status
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (ann: Announcement) => {
    if (!db) return;
    const newStatus = ann.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'announcements', ann.id), { status: newStatus });
      toast({ title: newStatus === 'active' ? "Anuncio Activado" : "Anuncio Inactivado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm('¿Eliminar permanentemente este anuncio?')) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      toast({ title: "Anuncio Eliminado" });
    } catch (e) {
      toast({ variant: "destructive", title: "Error" });
    }
  };

  if (!user || (user.role !== 'admin' && user.role !== 'coordinator' && user.role !== 'secretary')) {
    return (
      <div className="p-20 text-center bg-gray-50 rounded-3xl">
        <ShieldAlert className="w-16 h-16 text-destructive mx-auto opacity-20 mb-4" />
        <h2 className="text-2xl font-black text-destructive">Acceso Restringido</h2>
        <p className="text-muted-foreground font-bold">Solo personal administrativo puede gestionar la comunicación.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Comunicación Institucional</h1>
          <p className="text-muted-foreground font-medium">Gestiona los avisos y anuncios para el personal de Ciudad Don Bosco.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Formulario */}
        <Card className="lg:col-span-5 border-none shadow-2xl rounded-[2.5rem] bg-white overflow-hidden h-fit">
          <form onSubmit={handleSave}>
            <CardHeader className="bg-gray-50/50 p-8 border-b">
              <CardTitle className="text-xl font-black flex items-center gap-2">
                {editingId ? <Edit3 className="w-5 h-5 text-primary" /> : <PlusCircle className="w-5 h-5 text-primary" />}
                {editingId ? 'Editar Anuncio' : 'Nuevo Anuncio'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Título del Aviso</Label>
                <Input value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className="h-12 rounded-xl font-bold border-gray-100 bg-gray-50/50" placeholder="Ej: Cambio de Horarios" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contenido del Mensaje</Label>
                <Textarea value={formData.content} onChange={(e) => setFormData({...formData, content: e.target.value})} className="min-h-[150px] rounded-xl font-bold border-gray-100 bg-gray-50/50" placeholder="Escribe aquí el detalle del anuncio..." required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Prioridad</Label>
                  <Select value={formData.priority} onValueChange={(val: any) => setFormData({...formData, priority: val})}>
                    <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-100 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Importante (Rojo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Estado</Label>
                  <Select value={formData.status} onValueChange={(val: any) => setFormData({...formData, status: val})}>
                    <SelectTrigger className="h-12 rounded-xl bg-gray-50/50 border-gray-100 font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Activo (Visible)</SelectItem>
                      <SelectItem value="inactive">Inactivo (Oculto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-gray-50/50 p-8 border-t flex gap-3">
              <Button type="submit" className="flex-1 h-14 rounded-2xl font-black gap-2 shadow-lg" disabled={saving}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : editingId ? <Save className="w-5 h-5" /> : <Megaphone className="w-5 h-5" />}
                {editingId ? 'Guardar Cambios' : 'Publicar Aviso'}
              </Button>
              {editingId && (
                <Button variant="outline" className="h-14 w-14 rounded-2xl border-gray-200" onClick={() => { setEditingId(null); setFormData({title:'', content:'', priority:'normal', status:'active'}); }}>
                  <X className="w-6 h-6" />
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>

        {/* Lista de Anuncios */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-black text-gray-800 ml-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" /> Historial de Comunicaciones
          </h2>
          <div className="grid gap-4">
            {loading ? <Loader2 className="w-10 h-10 animate-spin mx-auto opacity-10" /> : announcements?.map(ann => (
              <Card key={ann.id} className={cn(
                "border-none shadow-xl rounded-[2rem] overflow-hidden bg-white transition-all hover:scale-[1.01]",
                ann.status === 'inactive' && "opacity-60 grayscale"
              )}>
                <CardContent className="p-8">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className={cn("text-[8px] font-black px-3 py-1", ann.priority === 'high' ? "bg-red-500" : "bg-primary")}>
                          {ann.priority === 'high' ? 'IMPORTANTE' : 'ESTÁNDAR'}
                        </Badge>
                        <Badge variant="outline" className={cn("text-[8px] font-black px-3 py-1", ann.status === 'active' ? "text-green-600 border-green-200 bg-green-50" : "text-gray-400 border-gray-200")}>
                          {ann.status === 'active' ? 'VISIBLE' : 'OCULTO'}
                        </Badge>
                      </div>
                      <h3 className="text-lg font-black text-gray-800">{ann.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{ann.content}</p>
                      <div className="flex items-center gap-3 pt-2 text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest">
                         <span>Por {ann.authorName}</span>
                         <span>•</span>
                         <span>{ann.createdAt?.toDate?.() ? ann.createdAt.toDate().toLocaleDateString() : 'Pendiente'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-primary hover:bg-primary/5" onClick={() => handleEdit(ann)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-muted-foreground" onClick={() => handleToggleStatus(ann)}>
                        {ann.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-xl h-10 w-10 text-destructive hover:bg-destructive/5" onClick={() => handleDelete(ann.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && announcements?.length === 0 && (
              <div className="py-20 text-center text-muted-foreground font-black uppercase tracking-widest opacity-20 italic">
                No hay anuncios registrados.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
