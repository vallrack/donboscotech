"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, User, QrCode, ShieldCheck, Mail, Building2, Clock, BookOpen, Fingerprint } from 'lucide-react';
import { Shift } from '@/lib/types';
import Image from 'next/image';
import { useMemo } from 'react';

export default function CarnetPage() {
  const { user } = useAuth();
  const db = useFirestore();

  // Obtenemos las jornadas para mostrar los nombres reales en lugar de IDs
  const { data: shifts } = useCollection<Shift>(db ? query(collection(db, 'shifts'), orderBy('name')) : null as any);

  const userShiftNames = useMemo(() => {
    if (!user?.shiftIds || !shifts) return 'No asignada';
    return user.shiftIds
      .map(id => shifts.find(s => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  }, [user?.shiftIds, shifts]);

  const handlePrint = () => {
    window.print();
  };

  if (!user) return null;

  // URL del QR optimizada para contraste y tamaño
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${user.id}&margin=10`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter">Credencial Institucional</h1>
          <p className="text-muted-foreground font-medium italic">Identificación oficial de acceso - Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-12 rounded-xl font-bold gap-2 shadow-sm bg-white" onClick={handlePrint}>
            <Printer className="w-5 h-5 text-primary" /> Imprimir Credencial
          </Button>
        </div>
      </div>

      <div className="flex justify-center items-center py-10 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-200">
        <Card className="w-[360px] h-[640px] bg-white shadow-2xl rounded-[2.5rem] overflow-hidden relative border-none print-card flex flex-col">
          {/* Header Superior Institucional */}
          <div className="bg-primary pt-10 pb-14 px-8 text-white text-center relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative z-10">
              <p className="font-black text-2xl tracking-tighter uppercase leading-tight">Ciudad Don Bosco</p>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-80 mt-1">Personal Autorizado</p>
            </div>
          </div>

          {/* Cuerpo Central: Foto, Nombre y QR */}
          <div className="flex-1 flex flex-col items-center -mt-10 relative z-10 px-6">
            <div className="w-32 h-32 rounded-3xl bg-white p-1 shadow-2xl border border-gray-100 mb-4">
               <div className="w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden">
                 {user.avatarUrl ? (
                   <Image src={user.avatarUrl} alt={user.name} width={128} height={128} className="object-cover w-full h-full" unoptimized />
                 ) : (
                   <User className="w-16 h-16 text-gray-200" />
                 )}
               </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-xl font-black text-gray-800 leading-tight uppercase tracking-tight px-4">{user.name}</h2>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary px-4 py-1.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {user.role === 'docent' ? 'Docente' : 
                   user.role === 'secretary' ? 'Secretaría' : 
                   user.role === 'coordinator' ? 'Coordinador' : 'Administrador'}
                </span>
              </div>
            </div>

            {/* QR Code Gigante para Escaneo Rápido */}
            <div className="w-full flex flex-col items-center mb-4">
              <div className="w-44 h-44 bg-white p-3 rounded-[2rem] shadow-xl border-2 border-gray-50 flex items-center justify-center overflow-hidden transition-all hover:scale-105">
                 <img 
                   src={qrUrl} 
                   alt="Código de Acceso" 
                   className="w-full h-full object-contain"
                 />
              </div>
              <span className="text-[8px] font-black text-primary/30 uppercase tracking-[0.5em] mt-3">Sincronización QR</span>
            </div>
          </div>

          {/* Bloque de Información Detallada */}
          <div className="p-8 bg-gray-50/80 border-t border-gray-100 space-y-5">
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                  <Fingerprint className="w-2.5 h-2.5 opacity-50" /> Cédula
                </div>
                <p className="text-[12px] font-black text-gray-700">{user.documentId || 'No registrada'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                  <Building2 className="w-2.5 h-2.5 opacity-50" /> Sede
                </div>
                <p className="text-[12px] font-black text-gray-700 truncate">{user.campus || 'Principal'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                  <BookOpen className="w-2.5 h-2.5 opacity-50" /> Programa
                </div>
                <p className="text-[12px] font-black text-primary truncate">{user.program || 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1.5 text-[8px] font-black text-muted-foreground uppercase tracking-widest">
                  <Clock className="w-2.5 h-2.5 opacity-50" /> Jornada
                </div>
                <p className="text-[11px] font-black text-gray-700 truncate">{userShiftNames}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
               <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-primary opacity-30" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Don Bosco Track Sinc</span>
               </div>
               <span className="text-[8px] font-mono text-gray-300 font-bold">UID: {user.id.substring(0, 10).toUpperCase()}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-md mx-auto no-print space-y-4">
        <div className="p-6 bg-yellow-50 rounded-[2rem] border border-yellow-100 flex items-start gap-4 shadow-sm">
           <div className="p-2.5 bg-yellow-100 rounded-xl text-yellow-600">
             <QrCode className="w-5 h-5" />
           </div>
           <div className="space-y-1">
             <p className="text-sm font-black text-yellow-800">Uso de Terminal</p>
             <p className="text-[11px] text-yellow-700 leading-relaxed font-bold">
               Presente este código a la terminal institucional. El sistema validará su ingreso automáticamente según su sede y jornada asignada.
             </p>
           </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-card, .print-card * { visibility: visible; }
          .print-card { 
            position: fixed; 
            left: 50%; 
            top: 50%; 
            transform: translate(-50%, -50%); 
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 2.5rem !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
