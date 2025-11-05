'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import { usePowerStatus, type PowerEvent } from '@/hooks/use-power-status';
import { useSoundStatus } from '@/hooks/use-sound-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PowerStatus } from '@/components/app/power-status';
import { AnalysisSheet } from '@/components/app/analysis-sheet';
import { useToast } from '@/hooks/use-toast';
import { Zap, ZapOff, Mic, MicOff } from 'lucide-react';
import { useAuth, useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { doc, serverTimestamp, collection, Timestamp } from 'firebase/firestore';
import { setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase/non-blocking-updates';


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

const StatusIndicator = ({ isActive, activeText, inactiveText, IconOn, IconOff }: { isActive: boolean | undefined, activeText: string, inactiveText: string, IconOn: React.ElementType, IconOff: React.ElementType }) => {
  if (isActive === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
        <IconOn className="h-5 w-5 animate-pulse" />
        <span>Checking...</span>
      </div>
    );
  }

  const statusText = isActive ? activeText : inactiveText;
  const Icon = isActive ? IconOn : IconOff;
  const colorClass = isActive ? 'text-green-500' : 'text-destructive';

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <span>{statusText}</span>
    </div>
  );
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
  const [displayTime, setDisplayTime] = useState(0);
  
  const [useSoundControl, setUseSoundControl] = useState(false);

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextStarted = useRef(false);
  const lastBellIntervalRef = useRef(0);

  const startAudioContext = useCallback(async () => {
    if (audioContextStarted.current) return;
    try {
      await Tone.start();
      audioContextStarted.current = true;
      console.log("Audio context started successfully.");
    } catch (e) {
      console.error("Audio could not start: ", e);
      toast({
          variant: "destructive",
          title: "Audio Error",
          description: "Could not start audio. Please interact with the page and try again.",
      });
    }
  }, [toast]);


  // Sound effects
  const powerOffSoundRef = useRef<Tone.Synth | null>(null);
  const powerOnSoundRef = useRef<Tone.Synth | null>(null);
  const bellSoundRef = useRef<Tone.MetalSynth | null>(null);

  useEffect(() => {
    if (!audioContextStarted.current) return;
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
    if (!bellSoundRef.current) {
      bellSoundRef.current = new Tone.MetalSynth({
        frequency: 250,
        envelope: { attack: 0.001, decay: 1.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      }).toDestination();
    }
  }, [audioContextStarted.current]);
  
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

  const handlePowerStatusChange = useCallback(async (event: PowerEvent) => {
    if (!audioContextStarted.current) {
        await startAudioContext();
    }
    
    if (powerEventsRef && user) {
        addDocumentNonBlocking(collection(powerEventsRef.firestore, 'power_events'), { ...event, userId: user.uid, deviceId: 'TBD' });
    }
    
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
  }, [powerEventsRef, toast, user, startAudioContext]);
  
  const isPowerOnline = usePowerStatus(handlePowerStatusChange);
  const { isSoundDetected, error: soundError, start: startSoundCheck, stop: stopSoundCheck } = useSoundStatus();

  useEffect(() => {
    if (useSoundControl) {
      startSoundCheck();
    } else {
      stopSoundCheck();
    }
    return () => stopSoundCheck();
  }, [useSoundControl, startSoundCheck, stopSoundCheck]);

  const isTimerActiveSource = useSoundControl ? isSoundDetected : isPowerOnline;


   const playBellSequence = useCallback((count: number) => {
    if (!bellSoundRef.current) return;
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
                    timerMode: isTimerActiveSource ? 'running' : 'paused'
                };
                if (!isTimerActiveSource) {
                    newTimerData.pauseTime = serverTimestamp() as unknown as Timestamp;
                }
                updateTimerState(newTimerData);
            }
        }
    }, 1000);
  }, [timerData, timerMode, updateTimerState, isTimerActiveSource, playBellSequence]); 
  
  useEffect(() => {
    if (isTimerActiveSource === undefined || isTimerLoading || !timerData) return;

    if (isTimerActiveSource) {
      if (timerMode === 'paused') {
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
    } else {
      if (timerMode === 'running') {
        updateTimerState({ 
            timerMode: 'paused',
            pauseTime: serverTimestamp() as unknown as Timestamp,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimerActiveSource, isTimerLoading, timerData?.timerMode]); 
  
  useEffect(() => {
    if (timerMode === 'running' || timerMode === 'break') {
      startTimerInterval();
    } else {
      stopTimerInterval();
      if (timerMode !== 'finished') {
          // When not running, calculate display time once based on server data
          if (timerData?.startTime && timerData.totalDuration > 0) {
              const now = Date.now();
              const serverStartTime = timerData.startTime.toDate().getTime();
              let elapsedSeconds = (now - serverStartTime) / 1000;
              elapsedSeconds -= timerData.accumulatedPauseTime || 0;

              if(timerMode === 'paused' && timerData.pauseTime) {
                  const serverPauseTime = timerData.pauseTime.toDate().getTime();
                  const currentPauseDuration = (now - serverPauseTime) / 1000;
                  elapsedSeconds -= currentPauseDuration;
              }
              
              const remaining = Math.max(0, timerData.totalDuration - elapsedSeconds);
              setDisplayTime(remaining);
          } else if (timerData?.totalDuration) {
              setDisplayTime(timerData.totalDuration);
          } else {
              setDisplayTime(0);
          }
      }
    }
    return () => {
        stopTimerInterval();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerMode, timerData?.startTime, timerData?.totalDuration, timerData?.accumulatedPauseTime, timerData?.pauseTime, timerData?.breakStartTime]);


  useEffect(() => {
    if (timerMode === 'finished') {
      const initAlarm = async () => {
        await startAudioContext();
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
  }, [timerMode, startAudioContext]);

  const handleStartTimer = async () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const durationInSeconds = (h * 3600) + (m * 60);
    
    if (durationInSeconds > 0) {
      await startAudioContext();
      
      const newTimerData: Partial<TimerData> = {
        totalDuration: durationInSeconds,
        lastSetDuration: durationInSeconds,
        startTime: serverTimestamp() as unknown as Timestamp,
        pauseTime: null,
        accumulatedPauseTime: 0,
        breakStartTime: null,
        timerMode: isTimerActiveSource ? 'running' : 'paused'
      };

      if(!isTimerActiveSource){
        newTimerData.pauseTime = serverTimestamp() as unknown as Timestamp;
      }
      
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
      lastSetDuration: 0,
    });
    setDisplayTime(0);
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
             <CardContent className="flex items-center justify-center p-6">
                <p>Loading...</p>
             </CardContent>
        )
    }

    if (timerMode === 'break') {
      return (
        <>
          <CardHeader>
            <CardTitle>Break Time</CardTitle>
            <CardDescription>Next timer starts in...</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <div className="text-6xl md:text-8xl font-black font-mono tracking-tighter tabular-nums text-primary">
              {formatTime(displayTime)}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleReset} variant="destructive" className="w-full">Cancel Next Timer</Button>
          </CardFooter>
        </>
      );
    }

    if (timerMode === 'idle') {
      return (
        <>
          <CardHeader>
            <CardTitle>Set Timer Duration</CardTitle>
            <CardDescription>
              {useSoundControl ? "Timer will run when sound is detected." : "Timer will run when power is available."}
            </CardDescription>
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
            <div className="flex items-center space-x-2">
              <Switch id="sound-control" checked={useSoundControl} onCheckedChange={setUseSoundControl} />
              <Label htmlFor="sound-control">Control via Sound</Label>
            </div>
             {soundError && <p className="text-xs text-destructive">{soundError}</p>}
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
            {timerMode === 'paused' 
              ? (useSoundControl ? 'Timer paused due to silence.' : 'Timer is paused due to power outage.')
              : 'Timer is active.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <div className="text-6xl md:text-8xl font-black font-mono tracking-tighter tabular-nums text-primary">
            {formatTime(displayTime)}
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-6 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(displayTime / (timerData?.totalDuration || 1)) * 100}%` }}></div>
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
             {useSoundControl ? (
              <StatusIndicator isActive={isSoundDetected} activeText="Sound Detected" inactiveText="Silence" IconOn={Mic} IconOff={MicOff} />
            ) : (
              <PowerStatus isOnline={isPowerOnline} />
            )}
        </div>
        <Card className="w-full shadow-2xl">
          {renderContent()}
        </Card>
        <p className="text-xs text-muted-foreground text-center mt-4">
           {useSoundControl
            ? "Status is based on microphone input."
            : "Power status is based on your device's charging state."}
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
