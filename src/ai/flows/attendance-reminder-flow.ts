'use server';
/**
 * @fileOverview Flujo de Genkit para enviar recordatorios de asistencia reales.
 * 
 * - sendAttendanceReminder - Genera contenido persuasivo y envía correo real vía Resend.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { Resend } from 'resend';

// API Key proporcionada por el usuario para asegurar el funcionamiento inmediato
const RESEND_KEY = 're_vQmMKAsk_JpfmPSBDVNWwoA9k3PxvhfL8';
const resend = new Resend(RESEND_KEY);

const AttendanceReminderInputSchema = z.object({
  userName: z.string().describe('Nombre del docente.'),
  userEmail: z.string().email().describe('Correo del docente.'),
  shiftName: z.string().describe('Nombre de la jornada que debe marcar.'),
  startTime: z.string().describe('Hora de inicio de la jornada.'),
});
export type AttendanceReminderInput = z.infer<typeof AttendanceReminderInputSchema>;

const AttendanceReminderOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  sentAt: z.string().optional(),
});
export type AttendanceReminderOutput = z.infer<typeof AttendanceReminderOutputSchema>;

/**
 * Envía un recordatorio real de asistencia al correo del docente.
 */
export async function sendAttendanceReminder(input: AttendanceReminderInput): Promise<AttendanceReminderOutput> {
  return attendanceReminderFlow(input);
}

const reminderPrompt = ai.definePrompt({
  name: 'attendanceReminderPrompt',
  input: { schema: AttendanceReminderInputSchema },
  output: { schema: z.object({ subject: z.string(), body: z.string() }) },
  prompt: `Genera un correo de recordatorio institucional para Ciudad Don Bosco.
  
  Contexto:
  - El docente {{userName}} aún no ha registrado su asistencia para la jornada "{{shiftName}}" que inicia a las {{startTime}}.
  
  Tono: Profesional, amable y enfocado en la puntualidad y el sello de seguridad.
  Idioma: Español.
  
  Genera un asunto (subject) y un cuerpo de mensaje (body) en formato HTML simple.`,
});

const attendanceReminderFlow = ai.defineFlow(
  {
    name: 'attendanceReminderFlow',
    inputSchema: AttendanceReminderInputSchema,
    outputSchema: AttendanceReminderOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await reminderPrompt(input);
      
      if (!output) throw new Error("Error generando contenido de recordatorio.");

      const { data, error } = await resend.emails.send({
        from: 'Don Bosco Track <onboarding@resend.dev>',
        to: input.userEmail,
        subject: output.subject,
        html: output.body,
      });

      if (error) {
        console.error("Error de Resend en recordatorio:", error);
        return {
          success: false,
          message: `Resend Error: ${error.message}`,
        };
      }

      console.log(`[RECORDATORIO ENVIADO EXITOSAMENTE A ${input.userEmail}]`);

      return {
        success: true,
        message: "Recordatorio enviado correctamente.",
        sentAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("Error en flujo de recordatorio:", error);
      return {
        success: false,
        message: `Error: ${error.message}`,
      };
    }
  }
);
