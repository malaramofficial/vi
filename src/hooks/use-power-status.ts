'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type PowerEvent = {
  status: 'online' | 'offline';
  timestamp: string;
};

export function usePowerStatus(onStatusChange?: (event: PowerEvent) => void) {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  });

  const updatePowerStatus = useCallback(async () => {
    if (!('getBattery' in navigator)) {
        if (isOnline === undefined) setIsOnline(true);
        return;
    }
    try {
      const battery = await (navigator as any).getBattery();
      const newStatus = battery.charging;

      if (isOnline !== newStatus) {
        setIsOnline(newStatus);
        if (onStatusChangeRef.current) {
          onStatusChangeRef.current({ status: newStatus ? 'online' : 'offline', timestamp: new Date().toISOString() });
        }
      }
    } catch (error) {
      console.error("Could not read battery status.", error);
      if (isOnline === undefined) setIsOnline(true);
    }
  }, [isOnline]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('getBattery' in navigator)) {
        setIsOnline(true); // Fallback for SSR or unsupported browsers
        return;
    }
    
    let batteryManager: any;

    const batteryEventHandler = () => updatePowerStatus();

    (navigator as any).getBattery().then((bm: any) => {
      batteryManager = bm;
      batteryManager.addEventListener('chargingchange', batteryEventHandler);
      updatePowerStatus();
    }).catch((e: Error) => {
      console.error("Battery status API not available.", e);
      setIsOnline(true);
    });

    return () => {
      if (batteryManager) {
        batteryManager.removeEventListener('chargingchange', batteryEventHandler);
      }
    };
  }, [updatePowerStatus]);

  return isOnline;
}
