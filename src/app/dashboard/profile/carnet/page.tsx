
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, User, QrCode, ShieldCheck, Mail, Building2, Clock } from 'lucide-react';
import { Shift } from '@/lib/types';
import Image from 'next/image';

export default function CarnetPage() {
  const { user } = useAuth();
  const db = useFirestore();

  const { data: shifts } = useCollection<Shift>(db ? query(collection(db, 'shifts'), orderBy('name')) : null as any);

  const handlePrint = () => {
    window.print();
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-primary">Carnet Institucional</h1>
          <p className="text-muted-foreground">Tu identificación digital oficial en Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-12 rounded-xl font-bold gap-2" onClick={handlePrint}>
            <Printer className="w-5 h-5" /> Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="flex justify-center items-center py-10 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-200">
        <Card className="w-[350px] min-h-[550px] bg-white shadow-2xl rounded-[2.5rem] overflow-hidden relative border-none print-card pb-16">
          {/* Header */}
          <div className="bg-primary h-32 relative flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="font-black text-xl tracking-tighter uppercase mb-1">Ciudad Don Bosco</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Track System</p>
          </div>

          {/* User Photo */}
          <div className="flex justify-center -mt-16 relative z-10">
            <div className="w-36 h-36 rounded-3xl bg-white p-1 shadow-xl border border-gray-100">
               <div className="w-full h-full rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                 {user.avatarUrl ? (
                   <Image src={user.avatarUrl} alt={user.name} width={144} height={144} className="object-cover" />
                 ) : (
                   <User className="w-16 h-16 text-gray-300" />
                 )}
               </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center space-y-5">
            <div>
              <h2 className="text-xl font-black text-gray-800 leading-tight mb-1">{user.name}</h2>
              <p className="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/5 py-1 px-3 rounded-full inline-block">
                {user.role === 'docent' ? 'Docente / Profesor' : 
                 user.role === 'secretary' ? 'Secretaría' : 
                 user.role === 'coordinator' ? 'Coordinador' : 'Administrador'}
              </p>
            </div>

            <div className="space-y-3 text-left bg-gray-50 p-5 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Documento</p>
                  <p className="text-xs font-bold text-gray-700">{user.documentId || 'C.C. NO ASIGNADA'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Programa / Sede</p>
                  <p className="text-xs font-bold text-gray-700">{user.program || 'N/A'} • {user.campus || 'Sede Principal'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-primary mt-1" />
                <div>
                  <p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Jornadas</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.shiftIds?.length ? user.shiftIds.map(sid => {
                      const s = shifts?.find(sh => sh.id === sid);
                      return s ? <span key={sid} className="text-[9px] font-bold bg-white px-2 py-0.5 rounded-lg border">{s.name}</span> : null;
                    }) : <span className="text-[9px] text-gray-400 italic">No asignadas</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer QR */}
          <div className="absolute bottom-0 left-0 right-0 bg-gray-100/50 p-6 flex items-center justify-between border-t border-gray-100">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase text-muted-foreground">ID SISTEMA</span>
              <span className="text-[10px] font-mono font-bold text-gray-500">{user.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div className="w-14 h-14 bg-white p-1 rounded-xl shadow-md border border-gray-200 flex items-center justify-center">
              <QrCode className="w-10 h-10 text-primary" />
            </div>
          </div>
        </Card>
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
            border: 1px solid #eee !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
