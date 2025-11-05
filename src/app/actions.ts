'use server';

import { analyzePowerOutageTrends } from '@/ai/flows/analyze-power-outage-trends';
import type { AnalyzePowerOutageTrendsOutput } from '@/ai/flows/analyze-power-outage-trends';

export async function getPowerOutageAnalysis(
  powerEventLog: string
): Promise<AnalyzePowerOutageTrendsOutput> {
  if (!powerEventLog || powerEventLog.trim() === '') {
    throw new Error('Power event log is empty.');
  }

  try {
    const analysis = await analyzePowerOutageTrends({ powerEventLog });
    return analysis;
  } catch (error) {
    console.error('Error in getPowerOutageAnalysis:', error);
    throw new Error('Failed to analyze power outage trends due to a server error.');
  }
}
