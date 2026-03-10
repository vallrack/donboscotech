
import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { sendAttendanceReminder } from '@/ai/flows/attendance-reminder-flow';
import { Shift, User } from '@/lib/types';

/**
 * API Route para recordatorios automáticos (Cron Job).
 * Este endpoint revisa a todos los docentes y envía correos a quienes no han marcado entrada.
 * Puede ser activado por Vercel Cron Jobs.
 */
export async function GET(request: Request) {
  const { firestore } = initializeFirebase();
  
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const [currH, currM] = timeStr.split(':').map(Number);
    const currTotal = currH * 60 + currM;
    const dayName = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'][now.getDay()];

    // 1. Obtener todas las jornadas institucionales
    const shiftsSnap = await getDocs(collection(firestore, 'shifts'));
    const allShifts = shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Shift));

    // 2. Obtener todos los perfiles de docentes
    const usersSnap = await getDocs(query(collection(firestore, 'userProfiles'), where('role', '==', 'docent')));
    const docents = usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User));

    let sentCount = 0;

    for (const docent of docents) {
      // Filtrar jornadas que el docente tiene asignadas para hoy
      const todayShifts = allShifts.filter(s => 
        docent.shiftIds?.includes(s.id) && s.days?.includes(dayName)
      );

      for (const s of todayShifts) {
        const [sh, sm] = s.startTime.split(':').map(Number);
        const startT = sh * 60 + sm;
        
        // Regla: Si estamos entre 10 min antes y 2 horas después del inicio
        if (currTotal >= (startT - 10) && currTotal <= (startT + 120)) {
          // Verificar si ya marcó entrada hoy
          const recordsSnap = await getDocs(query(
            collection(firestore, 'userProfiles', docent.id, 'attendanceRecords'), 
            where('date', '==', todayStr),
            where('type', '==', 'entry')
          ));

          if (recordsSnap.empty) {
            // No ha marcado -> Enviar recordatorio automático real vía Resend
            await sendAttendanceReminder({
              userName: docent.name,
              userEmail: docent.email,
              shiftName: s.name,
              startTime: s.startTime
            });
            sentCount++;
          }
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Escaneo completado. Se enviaron ${sentCount} recordatorios automáticos.`,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Error en Cron Job de recordatorios:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
