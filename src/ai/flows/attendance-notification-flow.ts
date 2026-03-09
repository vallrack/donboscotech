'use server';
/**
 * @fileOverview Flujo de Genkit para procesar alertas de asistencia reales vía Resend.
 * 
 * - notifyAttendance - Procesa un registro de asistencia y envía un correo real.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { Resend } from 'resend';

// Inicializar Resend (Requiere RESEND_API_KEY en Vercel/Enviroment Variables)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const AttendanceNotificationInputSchema = z.object({
  userName: z.string(),
  userEmail: z.string(),
  type: z.enum(['entry', 'exit']),
  time: z.string(),
  date: z.string(),
  method: z.string(),
  location: z.string().optional(),
});
export type AttendanceNotificationInput = z.infer<typeof AttendanceNotificationInputSchema>;

const AttendanceNotificationOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  alertContent: z.string().describe('Contenido generado para el cuerpo del correo de alerta.'),
});
export type AttendanceNotificationOutput = z.infer<typeof AttendanceNotificationOutputSchema>;

/**
 * Genera el contenido de una alerta de asistencia y envía el correo real.
 */
export async function notifyAttendance(input: AttendanceNotificationInput): Promise<AttendanceNotificationOutput> {
  return attendanceNotificationFlow(input);
}

const alertPrompt = ai.definePrompt({
  name: 'attendanceAlertPrompt',
  input: {schema: AttendanceNotificationInputSchema},
  output: {schema: z.object({ subject: z.string(), body: z.string() })},
  prompt: `Genera un mensaje formal de notificación de asistencia para Ciudad Don Bosco.
  
  Detalles del registro:
  - Colaborador: {{userName}}
  - Acción: {{#if (eq type 'entry')}}INGRESO{{else}}SALIDA{{/if}}
  - Fecha: {{date}}
  - Hora: {{time}}
  - Método: {{method}}
  - Ubicación: {{location}}

  El mensaje debe ser profesional, conciso y estar totalmente en ESPAÑOL. 
  Indica que el registro ha sido sincronizado en la plataforma Don Bosco Track.
  Genera un asunto (subject) y un cuerpo de mensaje (body) en formato HTML simple.`,
});

const attendanceNotificationFlow = ai.defineFlow(
  {
    name: 'attendanceNotificationFlow',
    inputSchema: AttendanceNotificationInputSchema,
    outputSchema: AttendanceNotificationOutputSchema,
  },
  async input => {
    try {
      const {output} = await alertPrompt(input);
      
      if (!output) throw new Error("Error generando contenido de alerta.");

      if (resend) {
        await resend.emails.send({
          from: 'Don Bosco Track <notificaciones@ciudaddonbosco.edu.co>',
          to: input.userEmail,
          subject: output.subject,
          html: output.body,
        });
        console.log(`[ALERTA REAL ENVIADA A ${input.userEmail}]`);
      } else {
        console.warn(`[MODO SIMULACIÓN - NO API KEY] Alerta para ${input.userEmail}: ${output.subject}`);
      }
      
      return {
        success: true,
        message: "Notificación enviada correctamente.",
        alertContent: output.body,
      };
    } catch (error: any) {
      console.error("Error en flujo de notificación:", error);
      return {
        success: false,
        message: `Error: ${error.message}`,
        alertContent: "Error en el proceso de envío.",
      };
    }
  }
);
