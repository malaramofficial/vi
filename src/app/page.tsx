'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { usePowerStatus, type PowerEvent } from '@/hooks/use-power-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PowerStatus } from '@/components/app/power-status';
import { AnalysisSheet } from '@/components/app/analysis-sheet';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Zap, ZapOff, Bell, BellOff, Play, Power, X } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, collection, Timestamp } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { cn } from '@/lib/utils';

type TimerMode = 'idle' | 'running' | 'paused' | 'finished' | 'break';

type TimerData = {
  timerMode: TimerMode;
  totalDuration: number;
  lastSetDuration: number;
  startTime: Timestamp | null;
  pauseTime: Timestamp | null;
  accumulatedPauseTime: number; // in seconds
  breakStartTime: Timestamp | null;
  updatedAt: any;
};

const TimerDisplay = ({ time, progress, timerMode }: { time: string, progress: number, timerMode: TimerMode }) => (
  <div className="relative flex items-center justify-center w-64 h-64">
    <svg className="absolute w-full h-full" viewBox="0 0 100 100">
      <circle
        className="text-muted/20"
        stroke="currentColor"
        strokeWidth="4"
        cx="50"
        cy="50"
        r="46"
        fill="transparent"
      />
      <circle
        className="text-primary transition-all duration-1000 ease-linear"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        cx="50"
        cy="50"
        r="46"
        fill="transparent"
        strokeDasharray={2 * Math.PI * 46}
        strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
        transform="rotate(-90 50 50)"
      />
    </svg>
    <div className="z-10 text-center">
      <div className="text-5xl font-black font-mono tracking-tighter tabular-nums text-primary">
        {time}
      </div>
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground mt-1">
        {timerMode === 'paused' ? 'Paused' : 'Remaining'}
      </p>
    </div>
  </div>
);


export default function Home() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const userTimerRef = useMemoFirebase(() => user ? doc(firestore, 'timers', user.uid) : null, [firestore, user]);
  const { data: timerData, isLoading: isTimerLoading } = useDoc<TimerData>(userTimerRef);

  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  
  const [alarm, setAlarm] = useState<Tone.PulseOscillator | null>(null);
  const [lfo, setLfo] = useState<Tone.LFO | null>(null);
  const [displayTime, setDisplayTime] = useState(0);

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [disconnectCountdown, setDisconnectCountdown] = useState(10);
  const disconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextStarted = useRef(false);
  const lastBellIntervalRef = useRef(0);
  const manualDisconnectRef = useRef(false);

  const startAudioContext = useCallback(async () => {
    if (audioContextStarted.current || Tone.context.state === 'running') {
      audioContextStarted.current = true;
      return;
    };
    try {
      await Tone.start();
      audioContextStarted.current = true;
      console.log("Audio context started successfully.");
    } catch (e) {
      console.error("Audio could not start: ", e);
    }
  }, []);

  const timerMode = timerData?.timerMode ?? 'idle';

  // Sound effects
  const powerOffSoundRef = useRef<Tone.Synth | null>(null);
  const powerOnSoundRef = useRef<Tone.Synth | null>(null);
  const bellSoundRef = useRef<Tone.MetalSynth | null>(null);

  useEffect(() => {
    powerOffSoundRef.current = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    }).toDestination();
    
    powerOnSoundRef.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    bellSoundRef.current = new Tone.MetalSynth({
      frequency: 250,
      envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
    }).toDestination();
  }, []);
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const updateTimerState = useCallback((newState: Partial<TimerData>) => {
    if (userTimerRef) {
      const data = {
        ...newState,
        updatedAt: serverTimestamp()
      }
      setDocumentNonBlocking(userTimerRef, data, { merge: true });
    }
  }, [userTimerRef]);

  const pauseTimerForPowerCut = useCallback(() => {
      updateTimerState({ 
          timerMode: 'paused',
          pauseTime: serverTimestamp() as unknown as Timestamp,
      });
  }, [updateTimerState]);
  
  const handlePowerStatusChange = useCallback(async (event: PowerEvent) => {
    if (!user || !firestore) return;
    
    const currentPowerEventsRef = collection(firestore, 'users', user.uid, 'powerEvents');
    addDocumentNonBlocking(currentPowerEventsRef, { ...event, userId: user.uid });
    
    if(!audioContextStarted.current) return;

    if (event.status === 'offline') {
      if (powerOffSoundRef.current) {
        powerOffSoundRef.current.triggerAttackRelease('C4', '8n');
      }
      // Check current timer mode directly from the most recent timerData
      if (timerData?.timerMode === 'running') {
        setShowDisconnectConfirm(true);
      }
    } else { // online
      manualDisconnectRef.current = false;
      if (powerOnSoundRef.current) {
        powerOnSoundRef.current.triggerAttackRelease('C5', '8n');
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Vidyut Sahayak', {
            body: event.status === 'online' ? 'Power has been restored.' : 'Power outage detected.',
            icon: event.status === 'online' ? '/zap.svg' : '/zap-off.svg',
          });
        }
      });
    }

    toast({
      title: event.status === 'online' ? 'Power Restored' : 'Power Outage',
      description: `Device is now ${event.status === 'online' ? 'charging' : 'on battery'}.`,
      action: event.status === 'online' ? <Zap className="text-green-500" /> : <ZapOff className="text-destructive" />,
    });
  }, [firestore, toast, user, timerData?.timerMode]);
  
  const isPowerOnline = usePowerStatus(handlePowerStatusChange);

  // Effect for disconnect confirmation dialog
  useEffect(() => {
    if (showDisconnectConfirm) {
      manualDisconnectRef.current = false;
      setDisconnectCountdown(10);

      // Start 10s timeout to auto-pause
      disconnectTimerRef.current = setTimeout(() => {
        if (!manualDisconnectRef.current) {
            pauseTimerForPowerCut();
        }
        setShowDisconnectConfirm(false);
      }, 10000);

      // Start 1s interval for countdown display
      countdownIntervalRef.current = setInterval(() => {
        setDisconnectCountdown(prev => Math.max(0, prev - 1));
      }, 1000);

    } else {
      // Cleanup timers when dialog is hidden
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }

    return () => {
      if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [showDisconnectConfirm, pauseTimerForPowerCut]);

  const handleManualDisconnect = () => {
    manualDisconnectRef.current = true;
    setShowDisconnectConfirm(false);
  };


  const playBellSequence = useCallback((count: number) => {
    if (!bellSoundRef.current || !audioContextStarted.current) return;
    const now = Tone.now();
    for (let i = 0; i < count; i++) {
      bellSoundRef.current.triggerAttack(now + i * 0.8);
    }
  }, []);

  const stopTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimerInterval = useCallback(() => {
    stopTimerInterval();
    if (!timerData) return;

    lastBellIntervalRef.current = 0;

    intervalRef.current = setInterval(() => {
        if (!timerData?.startTime) {
            setDisplayTime(0);
            return;
        }

        const now = Date.now();
        const serverStartTime = timerData.startTime.toDate().getTime();
        
        let elapsedSeconds = (now - serverStartTime) / 1000;
        
        elapsedSeconds -= timerData.accumulatedPauseTime || 0;
        
        if (timerMode === 'paused' && timerData.pauseTime) {
             const serverPauseTime = timerData.pauseTime.toDate().getTime();
             const currentPauseDuration = (now - serverPauseTime) / 1000;
             elapsedSeconds -= currentPauseDuration;
        }

        const remaining = Math.max(0, timerData.totalDuration - elapsedSeconds);
        setDisplayTime(remaining);

        // Bell logic
        const totalElapsedForBell = timerData.totalDuration - remaining;
        const currentInterval = Math.floor(totalElapsedForBell / 900); // 900 seconds = 15 minutes

        if (currentInterval > 0 && currentInterval > lastBellIntervalRef.current) {
            playBellSequence(currentInterval);
            lastBellIntervalRef.current = currentInterval;
        }

        if (remaining <= 0 && timerMode === 'running') {
            stopTimerInterval();
            updateTimerState({ timerMode: 'finished' });
        } else if (timerMode === 'break' && timerData.breakStartTime) {
            const breakStart = timerData.breakStartTime.toDate().getTime();
            const breakElapsed = (now - breakStart) / 1000;
            const breakRemaining = Math.max(0, 120 - breakElapsed); // 2 minutes break
            setDisplayTime(breakRemaining);
            if (breakRemaining <= 0) {
                stopTimerInterval();
                const newTimerData: Partial<TimerData> = {
                    totalDuration: timerData.lastSetDuration,
                    startTime: serverTimestamp() as unknown as Timestamp,
                    pauseTime: null,
                    accumulatedPauseTime: 0,
                    breakStartTime: null,
                    timerMode: 'running'
                };
                updateTimerState(newTimerData);
            }
        }
    }, 1000);
  }, [timerData, timerMode, updateTimerState, playBellSequence]); 
  
  useEffect(() => {
    if (isPowerOnline === undefined || isTimerLoading || !timerData?.timerMode) return;

    if (isPowerOnline && timerData.timerMode === 'paused' && !manualDisconnectRef.current) {
        const now = new Date().getTime();
        let newAccumulatedPauseTime = timerData.accumulatedPauseTime || 0;
        if (timerData.pauseTime) {
            const pauseDuration = (now - timerData.pauseTime.toDate().getTime()) / 1000;
            newAccumulatedPauseTime += pauseDuration;
        }
        updateTimerState({ 
            timerMode: 'running', 
            pauseTime: null,
            accumulatedPauseTime: newAccumulatedPauseTime
        });
    }
  }, [isPowerOnline, isTimerLoading, timerData, updateTimerState]); 
  
  useEffect(() => {
    if ((timerMode === 'running' || timerMode === 'paused' || timerMode === 'break') && !intervalRef.current) {
      startTimerInterval();
    } else if ((timerMode === 'idle' || timerMode === 'finished') && intervalRef.current) {
      stopTimerInterval();
    }
    
    if (timerMode === 'idle' || timerMode === 'finished') {
       if (timerData?.lastSetDuration && timerMode === 'idle') {
           setDisplayTime(timerData.lastSetDuration);
       } else {
           setDisplayTime(0);
       }
    }

    return () => stopTimerInterval();
  }, [timerMode, timerData, startTimerInterval]);

  useEffect(() => {
    if (timerMode === 'finished') {
      const initAlarm = async () => {
        if(!audioContextStarted.current) await startAudioContext();
        const alarmSynth = new Tone.PulseOscillator('C4', 0.4).toDestination();
        const alarmLfo = new Tone.LFO(5, 400, 4000).connect(alarmSynth.frequency).start();
        alarmSynth.start();
        setAlarm(alarmSynth);
        setLfo(alarmLfo);
      };
      if (!alarm && !lfo) {
        initAlarm();
      }
    } else {
      if (alarm) {
        alarm.stop();
        setAlarm(null);
      }
      if (lfo) {
        lfo.stop();
        setLfo(null);
      }
    }
  }, [timerMode, startAudioContext, alarm, lfo]);

  const handleStartTimer = async () => {
    await startAudioContext();

    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const durationInSeconds = (h * 3600) + (m * 60);
    
    if (durationInSeconds > 0) {
      const newTimerData: Partial<TimerData> = {
        totalDuration: durationInSeconds,
        lastSetDuration: durationInSeconds,
        startTime: serverTimestamp() as unknown as Timestamp,
        pauseTime: null,
        accumulatedPauseTime: 0,
        breakStartTime: null,
        timerMode: 'running'
      };
      
      updateTimerState(newTimerData);
    }
  };

  const handleReset = () => {
    updateTimerState({
      timerMode: 'idle',
      totalDuration: 0,
      startTime: null,
      pauseTime: null,
      accumulatedPauseTime: 0,
      breakStartTime: null,
      lastSetDuration: timerData?.lastSetDuration || 0
    });
    setDisplayTime(timerData?.lastSetDuration || 0);
  };

  const handleStopAlarm = () => {
    updateTimerState({ 
        timerMode: 'break',
        breakStartTime: serverTimestamp() as unknown as Timestamp,
    });
  };

  const formatTime = (seconds: number) => {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };
  
  const renderContent = () => {
    if (isTimerLoading || isUserLoading) {
        return (
             <CardContent className="flex items-center justify-center p-6 h-[450px]">
                <p>Loading...</p>
             </CardContent>
        )
    }

    if (timerMode === 'break') {
      return (
        <>
          <CardHeader>
            <CardTitle>Break Time</CardTitle>
            <CardDescription>Next timer will start automatically.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <TimerDisplay 
              time={formatTime(displayTime)} 
              progress={displayTime / 120} 
              timerMode={timerMode} 
            />
          </CardContent>
          <CardFooter>
            <Button onClick={handleReset} variant="destructive" className="w-full">
              <X className="mr-2 h-4 w-4" /> Cancel Next Timer
            </Button>
          </CardFooter>
        </>
      );
    }

    if (timerMode === 'idle') {
      return (
        <>
          <CardHeader className="text-center">
            <CardTitle>Set Timer Duration</CardTitle>
            <CardDescription>
              Timer pauses automatically on power outage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center justify-center gap-4">
              <div className="grid gap-2 text-center">
                <Label htmlFor="hours" className="text-sm">Hours</Label>
                <Input id="hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} min="0" className="w-24 text-center text-2xl h-16"/>
              </div>
              <div className="text-4xl font-bold text-muted-foreground pt-8">:</div>
              <div className="grid gap-2 text-center">
                <Label htmlFor="minutes" className="text-sm">Minutes</Label>
                <Input id="minutes" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} min="0" max="59" className="w-24 text-center text-2xl h-16"/>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleStartTimer} className="w-full" size="lg">
              <Play className="mr-2 h-5 w-5" /> Start Timer
            </Button>
          </CardFooter>
        </>
      );
    }

    return (
      <>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timer Active</CardTitle>
          <PowerStatus isOnline={isPowerOnline} />
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <TimerDisplay 
            time={formatTime(displayTime)} 
            progress={displayTime / (timerData?.totalDuration || 1)} 
            timerMode={timerMode} 
          />
          <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground">
              <Bell className="h-4 w-4" />
              <span>Rings every 15 minutes</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleReset} variant="destructive" className="w-full">
            <Power className="mr-2 h-4 w-4" /> Cancel and Reset
          </Button>
        </CardFooter>
      </>
    );
  };
  
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-radial">
      <AlertDialog open={showDisconnectConfirm} onOpenChange={setShowDisconnectConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>क्या आप चार्जर हटा रहे हैं?</AlertDialogTitle>
            <AlertDialogDescription>
              यदि आप चार्जर हटा रहे हैं तो टाइमर को चालू रखने के लिए पुष्टि करें। अन्यथा, यह 10 सेकंड में बिजली कटौती मानकर रुक जाएगा।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <Button variant="outline" className="relative" disabled>
                Auto-pausing in {disconnectCountdown}s...
            </Button>
            <Button onClick={handleManualDisconnect}>हाँ, टाइमर चालू रखें</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {timerMode === 'finished' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animation-flash">
          <h1 className="text-6xl font-bold text-destructive-foreground animate-pulse">TIME'S UP!</h1>
          <Button onClick={handleStopAlarm} size="lg" className="mt-8">
            <BellOff className="mr-2 h-5 w-5" /> Stop Alarm
          </Button>
        </div>
      )}

      <header className="absolute top-4 right-4 z-10">
        <AnalysisSheet />
      </header>

      <main className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-4xl font-black text-center text-primary mb-2">Vidyut Sahayak</h1>
        <p className="text-center text-muted-foreground mb-6">The Smart Line Timer</p>

        <Card className="w-full shadow-2xl bg-card/80 backdrop-blur-sm border-white/10">
          {renderContent()}
        </Card>
      </main>

      <footer className="absolute bottom-4 text-center">
        <p className="text-sm text-muted-foreground" style={{fontFamily: 'cursive', fontSize: '1rem'}}>
          Developed by Mala Ram Godara
        </p>
      </footer>
    </div>
  );
}
