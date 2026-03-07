
"use client"

import { useAuth } from '@/components/auth/auth-provider';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, User, ShieldCheck, Building2, Clock, BookOpen, Fingerprint } from 'lucide-react';
import { Shift } from '@/lib/types';
import Image from 'next/image';
import { useMemo } from 'react';

export default function CarnetPage() {
  const { user } = useAuth();
  const db = useFirestore();

  const shiftsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return query(collection(db, 'shifts'), orderBy('name'));
  }, [db]);

  const { data: shifts } = useCollection<Shift>(shiftsQuery as any);

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

      <div className="flex justify-center items-center py-10 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-200 no-print-bg">
        <Card className="w-[360px] min-h-[600px] h-auto bg-white shadow-2xl rounded-[2.5rem] overflow-hidden relative border-none print-card flex flex-col">
          {/* Header Superior Institucional */}
          <div className="bg-primary pt-8 pb-12 px-8 text-white text-center relative header-red">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative z-10">
              <p className="font-black text-2xl tracking-tighter uppercase leading-tight">Ciudad Don Bosco</p>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] opacity-80 mt-1">Personal Autorizado</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center -mt-8 relative z-10 px-6">
            <div className="w-28 h-28 rounded-3xl bg-white p-1 shadow-2xl border border-gray-100 mb-4">
               <div className="w-full h-full rounded-2xl bg-gray-50 flex items-center justify-center overflow-hidden">
                 {user.avatarUrl ? (
                   <Image src={user.avatarUrl} alt={user.name} width={112} height={112} className="object-cover w-full h-full" unoptimized />
                 ) : (
                   <User className="w-14 h-14 text-gray-200" />
                 )}
               </div>
            </div>

            <div className="text-center mb-4">
              <h2 className="text-lg font-black text-gray-800 leading-tight uppercase tracking-tight px-4">{user.name}</h2>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-primary/10 text-primary px-4 py-1 rounded-full role-badge">
                <ShieldCheck className="w-3 h-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {user.role === 'docent' ? 'Docente' : 
                   user.role === 'secretary' ? 'Secretaría' : 
                   user.role === 'coordinator' ? 'Coordinador' : 'Administrador'}
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col items-center mb-4">
              <div className="w-40 h-40 bg-white p-2 rounded-[2rem] shadow-lg border-2 border-gray-50 flex items-center justify-center overflow-hidden transition-all hover:scale-105">
                 <img 
                   src={qrUrl} 
                   alt="Código de Acceso" 
                   className="w-full h-full object-contain"
                 />
              </div>
              <span className="text-[7px] font-black text-primary/30 uppercase tracking-[0.5em] mt-2">SINCRONIZACIÓN QR</span>
            </div>
          </div>

          <div className="p-6 pb-8 bg-gray-50/80 border-t border-gray-100 space-y-4 info-section">
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[7px] font-black text-muted-foreground uppercase tracking-widest">
                  <Fingerprint className="w-2 h-2 opacity-50" /> CÉDULA
                </div>
                <p className="text-[11px] font-black text-gray-700">{user.documentId || 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1 text-[7px] font-black text-muted-foreground uppercase tracking-widest">
                  <Building2 className="w-2 h-2 opacity-50" /> SEDE
                </div>
                <p className="text-[11px] font-black text-gray-700 truncate">{user.campus || 'PRINCIPAL'}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[7px] font-black text-muted-foreground uppercase tracking-widest">
                  <BookOpen className="w-2 h-2 opacity-50" /> PROGRAMA
                </div>
                <p className="text-[11px] font-black text-primary truncate uppercase">{user.program || 'N/A'}</p>
              </div>
              <div className="space-y-1 text-right">
                <div className="flex items-center justify-end gap-1 text-[7px] font-black text-muted-foreground uppercase tracking-widest">
                  <Clock className="w-2 h-2 opacity-50" /> JORNADA
                </div>
                <p className="text-[10px] font-black text-gray-700 truncate uppercase">{userShiftNames}</p>
              </div>
            </div>
            
            <div className="pt-3 border-t border-dashed border-gray-200 flex items-center justify-between">
               <div className="flex items-center gap-1">
                  <ShieldCheck className="w-2.5 h-2.5 text-primary opacity-30" />
                  <span className="text-[7px] font-black text-gray-400 uppercase tracking-tighter">DON BOSCO TRACK SINC</span>
               </div>
               <span className="text-[7px] font-mono text-gray-300 font-bold uppercase">UID: {user.id.substring(0, 8)}</span>
            </div>
          </div>
        </Card>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-card, .print-card * { 
            visibility: visible; 
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-card { 
            position: absolute; 
            left: 50%; 
            top: 50%; 
            transform: translate(-50%, -50%); 
            box-shadow: none !important;
            border: 1px solid #e5e7eb !important;
            border-radius: 2.5rem !important;
            background-color: white !important;
            width: 340px !important;
          }
          .header-red {
            background-color: #a01c2c !important;
            color: white !important;
          }
          .role-badge {
            background-color: rgba(160, 28, 44, 0.1) !important;
            color: #a01c2c !important;
          }
          .info-section {
            background-color: #f9fafb !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
