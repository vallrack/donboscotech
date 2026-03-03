"use client"

import { useState, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Mail, Loader2, ShieldCheck } from 'lucide-react';
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
    if (!db || currentUser?.id === userId) return;

    setUpdating(userId);
    try {
      await updateDoc(doc(db, 'userProfiles', userId), { role: newRole });
      await deleteDoc(doc(db, 'roles_admins', userId));
      await deleteDoc(doc(db, 'roles_coordinators', userId));
      await deleteDoc(doc(db, 'roles_secretaries', userId));

      if (newRole === 'admin') await setDoc(doc(db, 'roles_admins', userId), { email: userEmail });
      else if (newRole === 'coordinator') await setDoc(doc(db, 'roles_coordinators', userId), { email: userEmail });
      else if (newRole === 'secretary') await setDoc(doc(db, 'roles_secretaries', userId), { email: userEmail });

      toast({ title: "Permisos Sincronizados", description: `El usuario ahora es ${newRole}.` });
    } catch (error) {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-primary">Gestión de Personal</h1>
          <p className="text-muted-foreground">Administra roles y accesos institucionales.</p>
        </div>
        <Badge variant="secondary" className="h-8 px-4 font-black flex items-center gap-2">
           <ShieldCheck className="w-3 h-3" /> CONTROL ADMINISTRATIVO
        </Badge>
      </div>

      <Card className="border-none shadow-xl rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-gray-50/50 pb-6 border-b">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nombre o correo..." 
              className="pl-10 h-12 border-gray-200 rounded-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/20 border-b text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  <th className="px-6 py-5">Usuario</th>
                  <th className="px-6 py-5">Rol Actual</th>
                  <th className="px-6 py-5">Asignar Permisos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr key="loading-users-row">
                    <td colSpan={3} className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-primary" /></td>
                  </tr>
                ) : (
                  filteredUsers.map((u, index) => {
                    const userId = (u as any).id || `user-${index}`;
                    return (
                      <tr key={userId} className="hover:bg-gray-50/30 transition-all">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                               {u.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-sm">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium"><Mail className="w-3 h-3" /> {u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <Badge variant={u.role === 'admin' ? 'default' : 'outline'} className="capitalize text-[10px] font-black">{u.role}</Badge>
                        </td>
                        <td className="px-6 py-5">
                          <Select 
                            disabled={updating === userId || currentUser?.id === userId}
                            onValueChange={(val) => handleRoleChange(userId, val as UserRole, u.email)}
                            defaultValue={u.role}
                          >
                            <SelectTrigger className="w-40 h-10 rounded-xl text-xs font-bold">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="docent">Docente</SelectItem>
                              <SelectItem value="secretary">Secretaría</SelectItem>
                              <SelectItem value="coordinator">Coordinador</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
