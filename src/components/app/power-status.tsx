'use client';

import { Zap, ZapOff } from 'lucide-react';

type PowerStatusProps = {
  isOnline: boolean | undefined;
};

export function PowerStatus({ isOnline }: PowerStatusProps) {
  if (isOnline === undefined) {
    return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <Zap className={`h-5 w-5 animate-pulse`} />
            <span>Checking...</span>
        </div>
    );
  }

  const statusText = isOnline ? 'Power On' : 'Power Off';
  const Icon = isOnline ? Zap : ZapOff;
  const colorClass = isOnline ? 'text-green-500' : 'text-destructive';

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
      <Icon className={`h-5 w-5 ${colorClass}`} />
      <span>{statusText}</span>
    </div>
  );
}
