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
import { useToast } from '@/hooks/use-toast';
import { Zap, ZapOff } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';


type TimerMode = 'idle' | 'running' | 'paused' | 'finished';

type TimerData = {
  timerMode: TimerMode;
  totalDuration: number;
  remainingTime: number;
  updatedAt: any;
};

export default function Home() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const userTimerRef = useMemoFirebase(() => user ? doc(firestore, 'timers', user.uid) : null, [firestore, user]);
  const { data: timerData, isLoading: isTimerLoading } = useDoc<TimerData>(userTimerRef);

  const powerEventsRef = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'powerEvents') : null, [firestore, user]);
  
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  
  const [alarm, setAlarm] = useState<Tone.PulseOscillator | null>(null);
  const [lfo, setLfo] = useState<Tone.LFO | null>(null);

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const localTimerRef = useRef<number | null>(null);

  // Sound effects
  const powerOffSoundRef = useRef<Tone.Synth | null>(null);
  const powerOnSoundRef = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    // Initialize sounds only once
    if (!powerOffSoundRef.current) {
      powerOffSoundRef.current = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
      }).toDestination();
    }
    if (!powerOnSoundRef.current) {
      powerOnSoundRef.current = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
      }).toDestination();
    }
  }, []);
  
  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);

  const updateTimerState = (newState: Partial<TimerData>) => {
    if (userTimerRef) {
      const data = {
        ...newState,
        updatedAt: serverTimestamp()
      }
      setDocumentNonBlocking(userTimerRef, data, { merge: true });
    }
  };
  
  const timerMode = timerData?.timerMode ?? 'idle';
  const totalDuration = timerData?.totalDuration ?? 0;
  const remainingTime = timerData?.remainingTime ?? 0;

  const handlePowerStatusChange = useCallback(async (event: PowerEvent) => {
    if (powerEventsRef) {
      addDocumentNonBlocking(powerEventsRef, event);
    }
    
    await Tone.start();
    if (event.status === 'offline') {
      if (powerOffSoundRef.current) {
        powerOffSoundRef.current.triggerAttackRelease('C4', '8n');
      }
    } else {
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
  }, [powerEventsRef, toast]);
  
  const isPowerOnline = usePowerStatus(handlePowerStatusChange);

  const stopTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimerInterval = () => {
    stopTimerInterval();
    localTimerRef.current = remainingTime;
    intervalRef.current = setInterval(() => {
      localTimerRef.current = (localTimerRef.current ?? 0) - 1;
      if ((localTimerRef.current ?? 0) <= 0) {
        stopTimerInterval();
        updateTimerState({ remainingTime: 0, timerMode: 'finished' });
      } else {
        // Periodically sync with firestore
        if ((localTimerRef.current ?? 0) % 5 === 0) {
             updateTimerState({ remainingTime: localTimerRef.current });
        }
      }
    }, 1000);
  };
  
  useEffect(() => {
    if (isPowerOnline === undefined || isTimerLoading || !timerData) return;

    if (isPowerOnline) {
      // If power is ON and timer was paused, resume it.
      if (timerMode === 'paused') {
        updateTimerState({ timerMode: 'running' });
      }
    } else {
      // If power is OFF and timer was running, pause it.
      if (timerMode === 'running') {
        updateTimerState({ timerMode: 'paused' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPowerOnline, isTimerLoading, timerData]); // Rerun when power status or timer data from firestore changes
  
  useEffect(() => {
    if (timerMode === 'running') {
      startTimerInterval();
    } else {
      stopTimerInterval();
      if (timerMode !== 'finished') {
          localTimerRef.current = null;
      }
    }
    return stopTimerInterval;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerMode]);

  useEffect(() => {
    if (timerMode === 'finished') {
      const initAlarm = async () => {
        await Tone.start();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerMode]);

  const handleStartTimer = () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const durationInSeconds = (h * 3600) + (m * 60);
    
    if (durationInSeconds > 0) {
      updateTimerState({
        totalDuration: durationInSeconds,
        remainingTime: durationInSeconds,
        timerMode: isPowerOnline ? 'running' : 'paused'
      });
    }
  };

  const handleReset = () => {
    updateTimerState({
      timerMode: 'idle',
      remainingTime: 0,
      totalDuration: 0,
    });
  };

  const handleStopAlarm = () => {
    updateTimerState({ timerMode: 'idle' });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };
  
  const displayTime = localTimerRef.current !== null && timerMode === 'running' 
    ? localTimerRef.current 
    : remainingTime;


  const renderContent = () => {
    if (isTimerLoading || isUserLoading) {
        return (
             <CardContent className="flex items-center justify-center p-6">
                <p>Loading...</p>
             </CardContent>
        )
    }
    if (timerMode === 'idle') {
      return (
        <>
          <CardHeader>
            <CardTitle>Set Timer Duration</CardTitle>
            <CardDescription>The timer will only count down when power is available.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-end gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hours">Hours</Label>
                <Input id="hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} min="0" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="minutes">Minutes</Label>
                <Input id="minutes" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} min="0" max="59"/>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleStartTimer} className="w-full">Start Timer</Button>
          </CardFooter>
        </>
      );
    }

    return (
      <>
        <CardHeader>
          <CardTitle>Timer Running</CardTitle>
          <CardDescription>
            {timerMode === 'paused' ? 'Timer is paused due to power outage.' : 'Timer is active.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="text-6xl md:text-8xl font-black font-mono tracking-tighter tabular-nums text-primary">
            {formatTime(displayTime)}
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-6 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(displayTime / totalDuration) * 100}%` }}></div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleReset} variant="destructive" className="w-full">Cancel and Reset</Button>
        </CardFooter>
      </>
    );
  };
  
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      {timerMode === 'finished' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center animation-flash">
          <h1 className="text-6xl font-bold text-destructive-foreground animate-pulse">TIME'S UP!</h1>
          <Button onClick={handleStopAlarm} size="lg" className="mt-8">Stop Alarm</Button>
        </div>
      )}

      <header className="absolute top-4 right-4 z-10">
        <AnalysisSheet />
      </header>

      <main className="w-full max-w-md flex flex-col items-center">
        <div className="flex justify-center items-center gap-4 mb-4">
            <h1 className="text-3xl font-bold text-center text-primary">Vidyut Sahayak</h1>
            <PowerStatus isOnline={isPowerOnline} />
        </div>
        <Card className="w-full shadow-2xl">
          {renderContent()}
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Power status is based on your device's charging state.
        </p>
      </main>

      <footer className="absolute bottom-4 text-center">
        <p className="text-sm text-muted-foreground" style={{fontFamily: 'cursive', fontSize: '1rem'}}>
          Developed by Mala Ram Godara
        </p>
      </footer>
    </div>
  );
}

    