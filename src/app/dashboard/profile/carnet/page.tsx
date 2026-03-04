
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

  // Generamos la URL del QR con un tamaño mayor (300x300) para máxima legibilidad
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${user.id}`;

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
        <Card className="w-[380px] min-h-[750px] bg-white shadow-2xl rounded-[3rem] overflow-hidden relative border-none print-card pb-12">
          {/* Header */}
          <div className="bg-primary h-36 relative flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <p className="font-black text-2xl tracking-tighter uppercase mb-1">Ciudad Don Bosco</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Track System v4.0</p>
          </div>

          {/* User Photo */}
          <div className="flex justify-center -mt-16 relative z-10">
            <div className="w-40 h-40 rounded-3xl bg-white p-1 shadow-2xl border border-gray-100">
               <div className="w-full h-full rounded-2xl bg-gray-100 flex items-center justify-center overflow-hidden">
                 {user.avatarUrl ? (
                   <Image src={user.avatarUrl} alt={user.name} width={160} height={160} className="object-cover" unoptimized />
                 ) : (
                   <User className="w-20 h-20 text-gray-300" />
                 )}
               </div>
            </div>
          </div>

          {/* QR Code - AUMENTADO Y POSICIONADO DEBAJO DE LA FOTO */}
          <div className="flex flex-col items-center justify-center mt-8 px-8">
            <div className="w-64 h-64 bg-white p-4 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border-4 border-primary/5 flex items-center justify-center overflow-hidden transition-transform hover:scale-105">
               <img 
                 src={qrUrl} 
                 alt="Código QR de Validación" 
                 className="w-full h-full object-contain"
               />
            </div>
            <div className="flex flex-col items-center gap-1 mt-4">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.4em] opacity-80">Escaneo de Acceso</span>
              <div className="w-12 h-1 bg-primary/20 rounded-full" />
            </div>
          </div>

          {/* Content */}
          <div className="p-8 text-center space-y-6">
            <div>
              <h2 className="text-2xl font-black text-gray-800 leading-tight mb-1">{user.name}</h2>
              <p className="text-xs font-black uppercase text-primary tracking-widest bg-primary/5 py-1.5 px-4 rounded-full inline-block">
                {user.role === 'docent' ? 'Docente / Profesor' : 
                 user.role === 'secretary' ? 'Secretaría' : 
                 user.role === 'coordinator' ? 'Coordinador' : 'Administrador'}
              </p>
            </div>

            <div className="space-y-4 text-left bg-gray-50/80 p-6 rounded-[2rem] border border-gray-100">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Documento Oficial</p>
                  <p className="text-sm font-bold text-gray-700">{user.documentId || 'C.C. NO ASIGNADA'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Programa / Sede</p>
                  <p className="text-sm font-bold text-gray-700">{user.program || 'N/A'} • {user.campus || 'Sede Principal'}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl shadow-sm">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase text-muted-foreground leading-none mb-1">Jornadas Asignadas</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {user.shiftIds?.length ? user.shiftIds.map(sid => {
                      const s = shifts?.find(sh => sh.id === sid);
                      return s ? <span key={sid} className="text-[9px] font-bold bg-white px-2 py-0.5 rounded-lg border border-gray-100 text-gray-600">{s.name}</span> : null;
                    }) : <span className="text-[9px] text-gray-400 italic">No asignadas</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-dashed border-gray-200 mt-4">
               <div className="flex flex-col items-center">
                 <span className="text-[10px] font-black uppercase text-muted-foreground mb-1">ID ÚNICO DE PERSONAL</span>
                 <span className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">
                   {user.id.toUpperCase()}
                 </span>
               </div>
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
