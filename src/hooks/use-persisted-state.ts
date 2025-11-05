'use client';
import { useState, useEffect, useCallback } from 'react';

function usePersistedState<T>(key: string, initialState: T): [T, (value: T | ((val: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialState;
    }
    try {
      const storageValue = window.localStorage.getItem(key);
      return storageValue ? JSON.parse(storageValue) : initialState;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialState;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(key, JSON.stringify(state));
        } catch (error) {
          console.warn(`Error setting localStorage key "${key}":`, error);
        }
    }
  }, [key, state]);

  return [state, setState];
}

export default usePersistedState;
