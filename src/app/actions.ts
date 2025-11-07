'use server';

import { analyzePowerOutageTrends } from '@/ai/flows/analyze-power-outage-trends';
import type { AnalyzePowerOutageTrendsOutput } from '@/ai/flows/analyze-power-outage-trends';
import { generateSpeech } from '@/ai/flows/generate-speech-flow';
import type { GenerateSpeechOutput } from '@/ai/flows/generate-speech-flow';

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

export async function getSpeechAudio(text: string): Promise<GenerateSpeechOutput> {
  try {
    const result = await generateSpeech({ text });
    return result;
  } catch (error) {
    console.error('Error in getSpeechAudio:', error);
    throw new Error('Failed to generate speech due to a server error.');
  }
}
