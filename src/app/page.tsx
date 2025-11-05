'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Tone from 'tone';
import usePersistedState from '@/hooks/use-persisted-state';
import { usePowerStatus, type PowerEvent } from '@/hooks/use-power-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PowerStatus } from '@/components/app/power-status';
import { AnalysisSheet } from '@/components/app/analysis-sheet';
import { useToast } from '@/hooks/use-toast';
import { Zap, ZapOff } from 'lucide-react';

type TimerMode = 'idle' | 'running' | 'paused' | 'finished';

export default function Home() {
  const [timerMode, setTimerMode] = usePersistedState<TimerMode>('timer-mode', 'idle');
  const [totalDuration, setTotalDuration] = usePersistedState('timer-total-duration', 0);
  const [remainingTime, setRemainingTime] = usePersistedState('timer-remaining-time', 0);
  const [powerEventLog, setPowerEventLog] = usePersistedState<PowerEvent[]>('power-event-log', []);

  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  
  const [alarm, setAlarm] = useState<Tone.PulseOscillator | null>(null);
  const [lfo, setLfo] = useState<Tone.LFO | null>(null);

  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound effects
  const powerOffSoundRef = useRef<Tone.Synth | null>(null);
  const powerOnSoundRef = useRef<Tone.Synth | null>(null);

  useEffect(() => {
    // Initialize sounds
    powerOffSoundRef.current = new Tone.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    }).toDestination();
    powerOnSoundRef.current = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();
  }, []);

  const handlePowerStatusChange = useCallback(async (event: PowerEvent) => {
    setPowerEventLog(prevLog => [...prevLog, event]);
    
    await Tone.start();
    if (event.status === 'offline') {
      powerOffSoundRef.current?.triggerAttackRelease("C4", "8n");
    } else {
      powerOnSoundRef.current?.triggerAttackRelease("C5", "8n");
    }

    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification('Vidyut Sahayak', {
          body: event.status === 'online' ? 'Power has been restored.' : 'Power outage detected.',
          icon: event.status === 'online' ? '/zap.svg' : '/zap-off.svg',
        });
      }
    });

    toast({
      title: event.status === 'online' ? 'Power Restored' : 'Power Outage',
      description: `Device is now ${event.status === 'online' ? 'charging' : 'on battery'}.`,
      action: event.status === 'online' ? <Zap className="text-green-500" /> : <ZapOff className="text-destructive" />,
    });
  }, [setPowerEventLog, toast]);
  
  const isPowerOnline = usePowerStatus(handlePowerStatusChange);

  const stopTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimerInterval = () => {
    stopTimerInterval();
    intervalRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          stopTimerInterval();
          setTimerMode('finished');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  useEffect(() => {
    if (isPowerOnline === undefined) return;

    if (timerMode === 'running' && !isPowerOnline) {
      setTimerMode('paused');
    } else if (timerMode === 'paused' && isPowerOnline) {
      setTimerMode('running');
    }
  }, [isPowerOnline, timerMode, setTimerMode]);

  useEffect(() => {
    if (timerMode === 'running') {
      startTimerInterval();
    } else {
      stopTimerInterval();
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
      initAlarm();
    } else {
      if (alarm) alarm.stop();
      if (lfo) lfo.stop();
      setAlarm(null);
      setLfo(null);
    }
  }, [timerMode, alarm, lfo]);

  const handleStartTimer = () => {
    const h = parseInt(hours, 10) || 0;
    const m = parseInt(minutes, 10) || 0;
    const durationInSeconds = (h * 3600) + (m * 60);
    
    if (durationInSeconds > 0) {
      setTotalDuration(durationInSeconds);
      setRemainingTime(durationInSeconds);
      setTimerMode(isPowerOnline ? 'running' : 'paused');
    }
  };

  const handleReset = () => {
    setTimerMode('idle');
    setRemainingTime(0);
    setTotalDuration(0);
  };

  const handleStopAlarm = () => {
    setTimerMode('idle');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const renderContent = () => {
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
            {formatTime(remainingTime)}
          </div>
          <div className="w-full bg-muted rounded-full h-2.5 mt-6 overflow-hidden">
            <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(remainingTime / totalDuration) * 100}%` }}></div>
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
        <AnalysisSheet log={powerEventLog} />
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
