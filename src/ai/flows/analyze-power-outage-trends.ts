'use server';
/**
 * @fileOverview Analyzes power outage trends using historical data and forecasts potential future outages.
 *
 * - analyzePowerOutageTrends - A function that analyzes power outage trends.
 * - AnalyzePowerOutageTrendsInput - The input type for the analyzePowerOutageTrends function.
 * - AnalyzePowerOutageTrendsOutput - The return type for the analyzePowerOutageTrends function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzePowerOutageTrendsInputSchema = z.object({
  powerEventLog: z
    .string()
    .describe(
      'A string containing the historical power event log data, with timestamps and power status (ON/OFF).'
    ),
});
export type AnalyzePowerOutageTrendsInput = z.infer<
  typeof AnalyzePowerOutageTrendsInputSchema
>;

const AnalyzePowerOutageTrendsOutputSchema = z.object({
  summary: z
    .string()
    .describe(
      'A summary of the power outage trends, including frequency, duration, and potential causes.'
    ),
  forecast: z
    .string()
    .describe(
      'A forecast of potential future power outages, including estimated time and duration.'
    ),
  recommendations: z
    .string()
    .describe(
      'Recommendations for the user to prepare for future power outages, such as backup power solutions or adjusting schedules.'
    ),
});
export type AnalyzePowerOutageTrendsOutput = z.infer<
  typeof AnalyzePowerOutageTrendsOutputSchema
>;

export async function analyzePowerOutageTrends(
  input: AnalyzePowerOutageTrendsInput
): Promise<AnalyzePowerOutageTrendsOutput> {
  return analyzePowerOutageTrendsFlow(input);
}

const analyzePowerOutageTrendsPrompt = ai.definePrompt({
  name: 'analyzePowerOutageTrendsPrompt',
  input: {schema: AnalyzePowerOutageTrendsInputSchema},
  output: {schema: AnalyzePowerOutageTrendsOutputSchema},
  prompt: `You are an AI assistant specializing in analyzing power outage data and providing insights to users.

  Analyze the following power event log data to identify trends, forecast potential future outages, and provide recommendations for the user.

  Power Event Log:
  {{powerEventLog}}

  Based on this data, provide the following:

  1.  A summary of the power outage trends, including frequency, duration, and potential causes.
  2.  A forecast of potential future power outages, including estimated time and duration.
  3.  Recommendations for the user to prepare for future power outages, such as backup power solutions or adjusting schedules.
  \nEnsure to provide the output in JSON format.\n  Do not add any additional information outside the JSON. Do not include a code fence.
  `,
});

const analyzePowerOutageTrendsFlow = ai.defineFlow(
  {
    name: 'analyzePowerOutageTrendsFlow',
    inputSchema: AnalyzePowerOutageTrendsInputSchema,
    outputSchema: AnalyzePowerOutageTrendsOutputSchema,
  },
  async input => {
    const {output} = await analyzePowerOutageTrendsPrompt(input);
    return output!;
  }
);
