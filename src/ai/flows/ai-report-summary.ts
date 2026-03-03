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
 * The prompt instructs the LLM to analyze structured attendance data
 * and extract key statistics, top absentees, and significant trends.
 */
const summarizeReportPrompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  input: {schema: AiReportSummaryInputSchema},
  output: {schema: AiReportSummaryOutputSchema},
  prompt: `You are an intelligent assistant tasked with summarizing attendance reports for an educational institution.
Your goal is to generate a concise summary, highlighting the following key statistics and insights from the provided attendance data:

1.  **Overall Punctuality**: Analyze the entry times and attendance statuses to describe the general punctuality of docents during the {{reportingPeriod}}. Include metrics like the total number or percentage of late arrivals, on-time arrivals, etc.
2.  **Top Absentees**: Identify and list the docents who have the highest number of absences or were absent for the longest duration during the {{reportingPeriod}}.
3.  **Significant Trends**: Look for any notable patterns or trends in the attendance data. This could include days of the week with consistently high lateness, improvements or deteriorations in punctuality over the period, or any other relevant observations.

The attendance report data for the {{reportingPeriod}} is provided below as a JSON array. Each object in the array represents a single attendance record for a docent. Ensure the summary is clear, concise, and actionable.

Attendance Data:
{{{json reportData}}}`,
});

/**
 * Defines the Genkit flow for generating an AI-powered summary of attendance reports.
 * It takes structured attendance data and a reporting period as input,
 * and returns an AI-generated summary.
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
