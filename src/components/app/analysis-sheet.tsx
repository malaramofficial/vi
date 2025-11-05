'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, BarChart2, AlertTriangle, List } from 'lucide-react';
import { getPowerOutageAnalysis } from '@/app/actions';
import type { PowerEvent } from '@/hooks/use-power-status';
import type { AnalyzePowerOutageTrendsOutput } from '@/ai/flows/analyze-power-outage-trends';
import { formatDistanceToNow } from 'date-fns';


type AnalysisSheetProps = {
  log: PowerEvent[];
};

export function AnalysisSheet({ log }: AnalysisSheetProps) {
  const [analysis, setAnalysis] = useState<AnalyzePowerOutageTrendsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    const logString = log.map(event => `${event.timestamp} - ${event.status.toUpperCase()}`).join('\n');

    if (log.length < 2) {
      setError("Not enough data to analyze. At least two power events are needed.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await getPowerOutageAnalysis(logString);
      setAnalysis(result);
    } catch (e) {
      setError("Failed to get analysis. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet>
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
            Review power event history and get AI-powered insights.
          </SheetDescription>
        </SheetHeader>
        <Separator />
        <div className="flex-grow min-h-0">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-6 py-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <List /> Event Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {log.length > 0 ? (
                    <ul className="space-y-2 text-sm">
                      {[...log].reverse().map((event, index) => (
                        <li key={index} className="flex items-center justify-between">
                          <span className={`font-medium ${event.status === 'online' ? 'text-green-500' : 'text-destructive'}`}>
                            {event.status === 'online' ? 'Power ON' : 'Power OFF'}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">No power events recorded yet.</p>
                  )}
                </CardContent>
              </Card>

              {isLoading && (
                 <div className="space-y-4">
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
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.summary}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle /> Forecast</CardTitle>
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.forecast}</p></CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg"><Lightbulb /> Recommendations</CardTitle>
                        </CardHeader>
                        <CardContent><p className="text-sm text-muted-foreground">{analysis.recommendations}</p></CardContent>
                    </Card>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        <SheetFooter className="pt-4">
          <Button onClick={handleAnalyze} disabled={isLoading || log.length < 2} className="w-full">
            {isLoading ? "Analyzing..." : "Analyze with AI"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
