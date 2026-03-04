'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating an AI-powered summary of attendance reports.
 *
 * - summarizeAttendanceReport - A function that handles the generation of the attendance report summary.
 * - AiReportSummaryInput - The input type for the summarizeAttendanceReport function.
 * - AiReportSummaryOutput - The return type for the summarizeAttendanceReport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

/**
 * Represents a single attendance record for a docent within a report.
 */
const AttendanceRecordSchema = z.object({
  userId: z.string().describe('The ID of the user (docent).'),
  userName: z.string().describe('The name of the user (docent).'),
  date: z.string().describe('The date of the attendance record (YYYY-MM-DD).'),
  entryTime: z.string().optional().describe('The time of entry (HH:MM).'),
  exitTime: z.string().optional().describe('The time of exit (HH:MM).'),
  totalHours: z.number().optional().describe('Total hours worked for the day.'),
  isLate: z.boolean().optional().describe('True if the docent was late for entry.'),
  isEarlyExit: z.boolean().optional().describe('True if the docent exited early.'),
  isAbsent: z.boolean().optional().describe('True if the docent was absent.'),
});

/**
 * Input schema for the AI report summary flow.
 * Contains the structured attendance data and the reporting period.
 */
const AiReportSummaryInputSchema = z.object({
  reportData: z
    .array(AttendanceRecordSchema)
    .describe('An array of structured attendance records for the reporting period.'),
  reportingPeriod: z
    .string()
    .describe('The period covered by the report, e.g., "October 2023", "Week 43", etc.'),
});
export type AiReportSummaryInput = z.infer<typeof AiReportSummaryInputSchema>;

/**
 * Output schema for the AI report summary flow.
 * Contains the AI-generated summary string.
 */
const AiReportSummaryOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A concise AI-generated summary of the attendance report, highlighting key statistics.'
    ),
});
export type AiReportSummaryOutput = z.infer<typeof AiReportSummaryOutputSchema>;

/**
 * Wrapper function to call the AI attendance report summary flow.
 * @param input The attendance report data and reporting period.
 * @returns A promise that resolves to the AI-generated summary.
 */
export async function summarizeAttendanceReport(
  input: AiReportSummaryInput
): Promise<AiReportSummaryOutput> {
  return aiReportSummaryFlow(input);
}

/**
 * Defines the prompt for generating an AI summary of attendance reports.
 */
const summarizeReportPrompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  input: {schema: AiReportSummaryInputSchema},
  output: {schema: AiReportSummaryOutputSchema},
  prompt: `Eres un asistente inteligente encargado de resumir informes de asistencia para una institución educativa (Ciudad Don Bosco).
Tu objetivo es generar un resumen conciso en ESPAÑOL, destacando las siguientes estadísticas e ideas clave de los datos de asistencia proporcionados:

1.  **Puntualidad General**: Analiza las horas de entrada y los estados de asistencia para describir la puntualidad general de los docentes durante el periodo {{reportingPeriod}}. Incluye métricas como el número total o porcentaje de llegadas tarde, llegadas a tiempo, etc.
2.  **Principales Ausencias**: Identifica y enumera a los docentes que tienen el mayor número de ausencias o que estuvieron ausentes durante la mayor duración durante el periodo {{reportingPeriod}}.
3.  **Tendencias Significativas**: Busca patrones o tendencias notables en los datos de asistencia. Esto podría incluir días de la semana con tardanzas consistentemente altas, mejoras o deterioros en la puntualidad a lo largo del periodo, o cualquier otra observación relevante.

Los datos del informe de asistencia para el periodo {{reportingPeriod}} se proporcionan a continuación como un arreglo JSON. Cada objeto en el arreglo representa un único registro de asistencia para un docente. Asegúrate de que el resumen sea claro, conciso y útil.

IMPORTANTE: El resumen debe estar escrito totalmente en ESPAÑOL. No utilices inglés bajo ninguna circunstancia.

Datos de asistencia:
{{{json reportData}}}`,
});

/**
 * Defines the Genkit flow for generating an AI-powered summary of attendance reports.
 */
const aiReportSummaryFlow = ai.defineFlow(
  {
    name: 'aiReportSummaryFlow',
    inputSchema: AiReportSummaryInputSchema,
    outputSchema: AiReportSummaryOutputSchema,
  },
  async input => {
    const {output} = await summarizeReportPrompt(input);
    return output!;
  }
);
