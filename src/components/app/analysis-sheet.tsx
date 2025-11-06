'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, BarChart2, AlertTriangle } from 'lucide-react';
import { getPowerOutageAnalysis } from '@/app/actions';
import type { AnalyzePowerOutageTrendsOutput } from '@/ai/flows/analyze-power-outage-trends';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';

export function AnalysisSheet() {
  const firestore = useFirestore();
  const { user } = useUser();
  
  const [analysis, setAnalysis] = useState<AnalyzePowerOutageTrendsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleAnalyze = async () => {
    if (!user || !firestore) {
      setError("User or database not available.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const powerEventsRef = query(collection(firestore, 'users', user.uid, 'powerEvents'), orderBy('timestamp', 'desc'));
      const logSnapshot = await getDocs(powerEventsRef);
      const log = logSnapshot.docs.map(doc => doc.data());

      if (log.length < 2) {
        setError("Not enough data to analyze. At least two power events are needed.");
        setIsLoading(false);
        return;
      }

      const logString = log.map(event => {
        const date = (event.timestamp as Timestamp).toDate();
        return `${date.toISOString()} - ${event.status?.toUpperCase() || 'UNKNOWN'}`;
      }).join('\n');

      const result = await getPowerOutageAnalysis(logString);
      setAnalysis(result);
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        setError(`Failed to get analysis: ${e.message}`);
      } else {
        setError("An unknown error occurred during analysis.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <BarChart2 className="mr-2 h-4 w-4" />
          Analysis
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Power Outage Analysis</SheetTitle>
          <SheetDescription>
            Get AI-powered insights based on your power event history.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex-grow min-h-0">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 py-4">
             
              {isLoading && (
                 <div className="space-y-4">
                    <p className="text-sm text-center text-muted-foreground">Analyzing your power history...</p>
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                 </div>
              )}

              {error && (
                <Card className="bg-destructive/10 border-destructive">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle /> Analysis Error
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-destructive">{error}</p>
                    </CardContent>
                </Card>
              )}

              {analysis && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><BarChart2 /> Summary</CardTitle>
                        </Header>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.summary}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle /> Forecast</CardTitle>
                        </Header>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.forecast}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><Lightbulb /> Recommendations</CardTitle>
                        </Header>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.recommendations}</p></CardContent>
                    </Card>
                </div>
              )}
               {!isLoading && !analysis && !error && (
                <div className="text-center text-muted-foreground py-10">
                    <p>Click the button below to analyze your power outage history and get insights.</p>
                </div>
               )}
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="pt-4">
          <Button onClick={handleAnalyze} disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Analyze with AI"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
