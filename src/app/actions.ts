'use server';

import { analyzePowerOutageTrends } from '@/ai/flows/analyze-power-outage-trends';
import type { AnalyzePowerOutageTrendsOutput } from '@/ai/flows/analyze-power-outage-trends';
import { getFirestore, collection, query, where, getDocs, deleteDoc, Timestamp } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/firebase/admin';

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

export async function deleteOldPowerEvents(userId: string): Promise<{ deletedCount: number }> {
  if (!userId) {
    throw new Error("User ID is required.");
  }
  
  try {
    initializeAdminApp();
    const db = getFirestore();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const ts = Timestamp.fromDate(twentyFourHoursAgo);

    const oldEventsQuery = query(
      collection(db, 'users', userId, 'powerEvents'),
      where('timestamp', '<', ts)
    );

    const snapshot = await getDocs(oldEventsQuery);
    
    if (snapshot.empty) {
      return { deletedCount: 0 };
    }

    const deletePromises: Promise<void>[] = [];
    snapshot.forEach(doc => {
      deletePromises.push(deleteDoc(doc.ref));
    });

    await Promise.all(deletePromises);

    console.log(`Successfully deleted ${snapshot.size} old power events for user ${userId}.`);
    return { deletedCount: snapshot.size };

  } catch (error) {
    console.error(`Error deleting old power events for user ${userId}:`, error);
    // Rethrow or handle as needed, but avoid exposing detailed errors to client
    throw new Error('Could not delete old power events.');
  }
}
