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

  // URL del QR optimizada para contraste y tamaño
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${user.id}&margin=10`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-primary tracking-tighter">Credencial Digital</h1>
          <p className="text-muted-foreground font-medium italic">Identificación oficial - Ciudad Don Bosco.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="h-12 rounded-xl font-bold gap-2 shadow-sm" onClick={handlePrint}>
            <Printer className="w-5 h-5 text-primary" /> Imprimir Credencial
          </Button>
        </div>
      </div>

      <div className="flex justify-center items-center py-6 bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-200">
        <Card className="w-[340px] h-[580px] bg-white shadow-2xl rounded-[2.5rem] overflow-hidden relative border-none print-card flex flex-col">
          {/* Header Superior Compacto */}
          <div className="bg-primary pt-8 pb-12 px-6 text-white text-center relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
            <p className="font-black text-xl tracking-tighter uppercase leading-tight">Ciudad Don Bosco</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.3em] opacity-70 mt-1">Personal Institucional</p>
          </div>

          {/* Foto y Datos Principales */}
          <div className="flex-1 flex flex-col items-center -mt-8 relative z-10 px-6">
            <div className="w-28 h-28 rounded-2xl bg-white p-1 shadow-xl border border-gray-100 mb-4">
               <div className="w-full h-full rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden">
                 {user.avatarUrl ? (
                   <Image src={user.avatarUrl} alt={user.name} width={112} height={112} className="object-cover" unoptimized />
                 ) : (
                   <User className="w-12 h-12 text-gray-200" />
                 )}
               </div>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-lg font-black text-gray-800 leading-tight uppercase tracking-tight">{user.name}</h2>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1 bg-primary/5 px-3 py-1 rounded-full inline-block">
                {user.role === 'docent' ? 'Docente' : 
                 user.role === 'secretary' ? 'Secretaría' : 
                 user.role === 'coordinator' ? 'Coordinador' : 'Administrador'}
              </p>
            </div>

            {/* QR Code - Gran Tamaño para Escaneo Inmediato */}
            <div className="w-full flex flex-col items-center">
              <div className="w-48 h-48 bg-white p-2 rounded-3xl shadow-lg border-2 border-gray-50 flex items-center justify-center overflow-hidden transition-all hover:scale-105 active:scale-95">
                 <img 
                   src={qrUrl} 
                   alt="QR de Validación" 
                   className="w-full h-full object-contain"
                 />
              </div>
              <span className="text-[8px] font-black text-primary/40 uppercase tracking-[0.4em] mt-3">Código de Acceso</span>
            </div>
          </div>

          {/* Info Block Inferior - Compacto */}
          <div className="p-6 bg-gray-50/80 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Cédula</p>
                <p className="text-[11px] font-bold text-gray-700">{user.documentId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[7px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">Sede / Programa</p>
                <p className="text-[11px] font-bold text-gray-700 truncate">{user.campus || 'Principal'} / {user.program || 'N/A'}</p>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
               <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3 h-3 text-primary opacity-50" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">Don Bosco Track v4.0</span>
               </div>
               <span className="text-[8px] font-mono text-gray-300">ID: {user.id.substring(0, 8).toUpperCase()}</span>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-md mx-auto no-print">
        <div className="p-6 bg-yellow-50 rounded-3xl border border-yellow-100 flex items-start gap-4 shadow-sm">
           <div className="p-2 bg-yellow-100 rounded-xl text-yellow-600">
             <QrCode className="w-5 h-5" />
           </div>
           <div className="space-y-1">
             <p className="text-sm font-black text-yellow-800">Consejo de Escaneo</p>
             <p className="text-xs text-yellow-700 leading-relaxed font-medium">
               Muestra este QR a la terminal institucional a una distancia de 15-20cm. El tamaño ha sido optimizado para una validación instantánea.
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
            border: 1px solid #eee !important;
            border-radius: 2rem !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
