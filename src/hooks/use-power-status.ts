'use client';

import { useState, useEffect, useCallback } from 'react';

export type PowerEvent = {
  status: 'online' | 'offline';
  timestamp: string;
};

export function usePowerStatus(onStatusChange?: (event: PowerEvent) => void) {
  const [isOnline, setIsOnline] = useState<boolean | undefined>(undefined);

  const updatePowerStatus = useCallback(async () => {
    if (!('getBattery' in navigator)) {
        if (isOnline === undefined) setIsOnline(true);
        return;
    }
    try {
      const battery = await (navigator as any).getBattery();
      const newStatus = battery.charging;

      // Only update and call callback if status has actually changed, or it's the first run
      if (isOnline !== newStatus) {
        setIsOnline(newStatus);
        onStatusChange?.({ status: newStatus ? 'online' : 'offline', timestamp: new Date().toISOString() });
      }
    } catch (error) {
      console.error("Could not read battery status.", error);
      if (isOnline === undefined) setIsOnline(true); // Fallback on error
    }
  }, [isOnline, onStatusChange]);

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
      // Initial check
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
