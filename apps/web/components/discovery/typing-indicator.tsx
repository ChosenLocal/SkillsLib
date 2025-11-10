/**
 * Typing Indicator Component
 *
 * Displays an animated "AI is thinking..." indicator
 */

import { cn } from '@/lib/utils';

export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start mb-4">
      <div className="bg-muted rounded-lg px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">AI is thinking</span>
          <div className="flex gap-1">
            <Dot delay="0ms" />
            <Dot delay="150ms" />
            <Dot delay="300ms" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <div
      className={cn(
        'w-2 h-2 rounded-full bg-muted-foreground',
        'animate-bounce'
      )}
      style={{
        animationDelay: delay,
        animationDuration: '1s',
      }}
    />
  );
}
