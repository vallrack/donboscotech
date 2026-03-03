
"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Shield, UserCog, UserCheck, Trash2, Loader2, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@/lib/types';

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

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
    if (!db || currentUser?.id === userId) {
      if (currentUser?.id === userId) {
        toast({
          variant: "destructive",
          title: "Acción no permitida",
          description: "No puedes cambiar tu propio rol para evitar perder el acceso administrativo."
        });
      }
      return;
    }

    setUpdating(userId);
    try {
      // 1. Update Profile
      await updateDoc(doc(db, 'userProfiles', userId), { role: newRole });

      // 2. Sync with specific role collections for Security Rules
      // Remove from all first
      await deleteDoc(doc(db, 'roles_admins', userId));
      await deleteDoc(doc(db, 'roles_coordinators', userId));
      await deleteDoc(doc(db, 'roles_secretaries', userId));

      // Add to the correct one if needed
      if (newRole === 'admin') {
        await setDoc(doc(db, 'roles_admins', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'coordinator') {
        await setDoc(doc(db, 'roles_coordinators', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      } else if (newRole === 'secretary') {
        await setDoc(doc(db, 'roles_secretaries', userId), { email: userEmail, assignedAt: new Date().toISOString() });
      }

      toast({
        title: "Rol Actualizado",
        description: `El usuario ahora tiene el rol de ${newRole}.`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al actualizar",
        description: "No se pudo cambiar el rol del usuario."
      });
    } finally {
      setUpdating(null);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Shield className="w-16 h-16 text-destructive mb-4 opacity-20" />
        <h2 className="text-2xl font-bold text-destructive">Acceso Denegado</h2>
        <p className="text-muted-foreground mt-2">Solo los administradores pueden gestionar usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-primary">Gestión de Personal</h1>
        <p className="text-muted-foreground">Administra los roles y permisos de Ciudad Don Bosco.</p>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <CardHeader className="pb-6 border-b">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o correo..." 
              className="pl-10 h-11 border-gray-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-6 py-4">Rol Actual</th>
                  <th className="px-6 py-4">Cambiar Permisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr key="loading">
                    <td colSpan={3} className="py-20 text-center">
                      <Loader2 className="w-10 h-10 animate-spin mx-auto text-muted-foreground opacity-20" />
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id || u.uid} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {u.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-sm">{u.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={u.role === 'admin' ? 'default' : u.role === 'docent' ? 'outline' : 'secondary'} className="capitalize text-[10px]">
                          {u.role || 'docent'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Select 
                            defaultValue={u.role || 'docent'} 
                            disabled={updating === (u.id || u.uid) || currentUser?.id === (u.id || u.uid)}
                            onValueChange={(val) => handleRoleChange(u.id || u.uid, val as UserRole, u.email)}
                          >
                            <SelectTrigger className="w-32 h-9 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="docent">Docente</SelectItem>
                              <SelectItem value="secretary">Secretaría</SelectItem>
                              <SelectItem value="coordinator">Coordinador</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                          {updating === (u.id || u.uid) && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredUsers.length === 0 && (
            <div className="p-16 text-center text-muted-foreground text-sm italic">
              No se encontraron usuarios.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
