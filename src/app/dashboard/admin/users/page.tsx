
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Mail, Loader2, ShieldCheck, UserCog, UserCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const usersQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'userProfiles'), orderBy('name', 'asc'));
  }, [db]);

  const { data: users, loading } = useCollection(usersQuery as any);

  const filteredUsers = useMemo(() => {
    return (users || []).filter(u => 
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleRoleChange = async (userId: string, newRole: UserRole, userEmail: string) => {
    if (!db || !userId) return;
    
    // Evitar que el admin se quite permisos a sí mismo por error
    if (currentUser?.id === userId && newRole !== 'admin') {
      toast({
        variant: "destructive",
        title: "Operación no permitida",
        description: "No puedes cambiar tu propio rol administrativo para evitar perder el acceso al sistema."
      });
      return;
    }

    setUpdatingId(userId);
    try {
      // 1. Actualizar el perfil principal
      await updateDoc(doc(db, 'userProfiles', userId), { 
        role: newRole,
        updatedAt: new Date().toISOString()
      });

      // 2. Limpiar registros en colecciones de roles de seguridad (Security Rules)
      const roleCollections = ['roles_admins', 'roles_coordinators', 'roles_secretaries'];
      for (const col of roleCollections) {
        await deleteDoc(doc(db, col, userId));
      }

      // 3. Asignar a la nueva colección si corresponde para habilitar las reglas de Firestore
      if (newRole === 'admin') {
        await setDoc(doc(db, 'roles_admins', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'coordinator') {
        await setDoc(doc(db, 'roles_coordinators', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'secretary') {
        await setDoc(doc(db, 'roles_secretaries', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      }

      toast({ 
        title: "Permisos Actualizados", 
        description: `El usuario ${userEmail} ahora es ${newRole.toUpperCase()}.` 
      });
    } catch (error) {
      console.error(error);
      toast({ 
        title: "Error al actualizar", 
        description: "No se pudieron sincronizar los permisos. Intente de nuevo.",
        variant: "destructive" 
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary">Gestión de Personal</h1>
          <p className="text-muted-foreground">Control de accesos y roles institucionales para Ciudad Don Bosco.</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-2xl border border-primary/10">
           <ShieldCheck className="w-5 h-5 text-primary" />
           <span className="text-xs font-black text-primary uppercase tracking-wider">Modo Administrador Activo</span>
        </div>
      </div>

      <Card className="border-none shadow-2xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-6 border-b p-8">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre, apellido o correo electrónico..." 
              className="pl-12 h-14 border-gray-200 rounded-2xl bg-white shadow-sm text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/30 border-b text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-8 py-6">Información del Usuario</th>
                  <th className="px-8 py-6">Nivel de Acceso</th>
                  <th className="px-8 py-6">Acción de Permisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr key="loading-users">
                    <td colSpan={3} className="py-24 text-center">
                      <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary opacity-20" />
                      <p className="text-sm mt-4 font-bold text-muted-foreground">Sincronizando con base de datos...</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const userId = u.id;
                    const isUpdating = updatingId === userId;
                    const isSelf = currentUser?.id === userId;
                    
                    return (
                      <tr key={userId} className="hover:bg-gray-50/50 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">
                               {u.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-base text-gray-800 flex items-center gap-2">
                                {u.name}
                                {isSelf && <Badge variant="outline" className="text-[9px] font-black text-primary border-primary/20">TÚ</Badge>}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1 font-medium mt-0.5">
                                <Mail className="w-3.5 h-3.5" /> {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1.5">
                            <Badge 
                              variant={u.role === 'admin' ? 'default' : 'secondary'} 
                              className={cn(
                                "w-fit capitalize text-[10px] font-black px-4 py-1.5 rounded-xl border-none",
                                u.role === 'admin' ? "bg-primary shadow-lg shadow-primary/20" : "bg-gray-200 text-gray-700"
                              )}
                            >
                              {u.role === 'docent' ? 'Docente' : 
                               u.role === 'coordinator' ? 'Coordinador' : 
                               u.role === 'secretary' ? 'Secretaría' : 'Administrador'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <Select 
                              disabled={isUpdating || isSelf}
                              onValueChange={(val) => handleRoleChange(userId, val as UserRole, u.email)}
                              defaultValue={u.role || 'docent'}
                            >
                              <SelectTrigger className="w-52 h-12 rounded-2xl text-xs font-black border-gray-200 shadow-sm bg-white">
                                <div className="flex items-center gap-2">
                                  {isUpdating ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <UserCog className="w-4 h-4 text-primary" />}
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent className="rounded-2xl border-none shadow-2xl">
                                <SelectItem value="docent" className="font-bold py-3">Docente (Acceso Base)</SelectItem>
                                <SelectItem value="secretary" className="font-bold py-3">Secretaría (Reportes)</SelectItem>
                                <SelectItem value="coordinator" className="font-bold py-3">Coordinador (Marcaje Manual)</SelectItem>
                                <SelectItem value="admin" className="font-black py-3 text-primary">Administrador (Total)</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {u.role === 'admin' && !isSelf && (
                              <div className="p-2 bg-yellow-50 rounded-xl text-yellow-600" title="Acceso de alto nivel">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredUsers.length === 0 && (
            <div className="p-24 text-center">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-gray-200" />
              </div>
              <p className="text-muted-foreground font-bold text-lg">No se encontraron usuarios registrados.</p>
              <p className="text-sm text-muted-foreground mt-2">Intenta con otro término de búsqueda.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-50 pt-4">
        &copy; Sistema de Gestión de Permisos Ciudad Don Bosco
      </p>
    </div>
  );
}
