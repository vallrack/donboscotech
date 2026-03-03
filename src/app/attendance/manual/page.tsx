"use client"

import { useState } from 'react';
import { MOCK_USERS } from '@/lib/mock-data';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search, UserCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function ManualAttendancePage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [markedUsers, setMarkedUsers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const docents = MOCK_USERS.filter(u => 
    u.role === 'docent' && 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleUser = (userId: string) => {
    const newMarked = new Set(markedUsers);
    if (newMarked.has(userId)) {
      newMarked.delete(userId);
    } else {
      newMarked.add(userId);
    }
    setMarkedUsers(newMarked);
  };

  const handleSave = () => {
    if (markedUsers.size === 0) return;
    
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast({
        title: "Registros Guardados",
        description: `Se ha marcado la jornada para ${markedUsers.size} docentes exitosamente.`
      });
      setMarkedUsers(new Set());
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Marcaje Manual</h1>
          <p className="text-muted-foreground">Gestione la asistencia de docentes que no pueden usar el sistema QR.</p>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600" />
          <p className="text-xs text-yellow-800 font-medium">
            Los registros manuales quedan auditados como "Cumplió Jornada" por el coordinador responsable.
          </p>
        </div>
      </div>

      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <CardHeader className="pb-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar docente por nombre o correo..." 
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-y text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4">Docente</th>
                  <th className="px-6 py-4">Rol</th>
                  <th className="px-6 py-4">Estado Actual</th>
                  <th className="px-6 py-4 text-center">Cumplió Jornada</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {docents.map((docent) => (
                  <tr key={docent.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold">{docent.name}</div>
                      <div className="text-xs text-muted-foreground">{docent.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {docent.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        <span className="text-xs">Sin registro</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <Checkbox 
                          checked={markedUsers.has(docent.id)}
                          onCheckedChange={() => toggleUser(docent.id)}
                          className="w-6 h-6 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {docents.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              No se encontraron docentes con ese criterio de búsqueda.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
          size="lg" 
          disabled={markedUsers.size === 0 || saving}
          onClick={handleSave}
          className="px-10 h-12 text-lg font-bold shadow-lg"
        >
          <UserCheck className="w-5 h-5 mr-2" />
          {saving ? "Guardando..." : `Confirmar ${markedUsers.size} registros`}
        </Button>
      </div>
    </div>
  );
}