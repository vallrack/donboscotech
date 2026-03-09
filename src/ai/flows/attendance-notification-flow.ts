'use server';
/**
 * @fileOverview Flujo de Genkit para procesar alertas de asistencia.
 * 
 * - notifyAttendance - Procesa un registro de asistencia y genera el contenido de una alerta.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

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
 * Genera el contenido de una alerta de asistencia y simula el envío de un correo.
 */
export async function notifyAttendance(input: AttendanceNotificationInput): Promise<AttendanceNotificationOutput> {
  return attendanceNotificationFlow(input);
}

const alertPrompt = ai.definePrompt({
  name: 'attendanceAlertPrompt',
  input: {schema: AttendanceNotificationInputSchema},
  output: {schema: AttendanceNotificationOutputSchema},
  prompt: `Genera un mensaje formal de notificación de asistencia para Ciudad Don Bosco.
  
  Detalles del registro:
  - Colaborador: {{userName}}
  - Acción: {{#if (eq type 'entry')}}INGRESO{{else}}SALIDA{{/if}}
  - Fecha: {{date}}
  - Hora: {{time}}
  - Método: {{method}}
  - Ubicación: {{location}}

  El mensaje debe ser profesional, conciso y estar totalmente en ESPAÑOL. 
  Indica que el registro ha sido sincronizado en la plataforma Don Bosco Track.`,
});

const attendanceNotificationFlow = ai.defineFlow(
  {
    name: 'attendanceNotificationFlow',
    inputSchema: AttendanceNotificationInputSchema,
    outputSchema: AttendanceNotificationOutputSchema,
  },
  async input => {
    const {output} = await alertPrompt(input);
    
    // Aquí es donde se integraría el envío real del correo (ej: Resend, SendGrid)
    console.log(`[ALERTA ENVIADA A ${input.userEmail}]: ${output?.alertContent}`);
    
    return {
      success: true,
      message: "Notificación procesada correctamente.",
      alertContent: output?.alertContent || "Sin contenido.",
    };
  }
);
