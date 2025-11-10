/**
 * Completeness Meter Component
 *
 * Circular progress indicator showing how much of the schema has been filled.
 * Displays percentage and color-coded status.
 */

'use client';

import { cn } from '@/lib/utils';

export interface CompletenessMeterProps {
  completeness: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function CompletenessMeter({
  completeness,
  size = 'md',
  showLabel = true,
}: CompletenessMeterProps) {
  // Clamp between 0-100
  const percent = Math.max(0, Math.min(100, completeness));

  // Determine color based on completeness
  const getColor = () => {
    if (percent < 30) return 'text-destructive';
    if (percent < 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStrokeColor = () => {
    if (percent < 30) return 'stroke-destructive';
    if (percent < 70) return 'stroke-yellow-500';
    return 'stroke-green-500';
  };

  // Size configurations
  const sizeConfig = {
    sm: { radius: 30, strokeWidth: 4, fontSize: 'text-sm' },
    md: { radius: 45, strokeWidth: 6, fontSize: 'text-lg' },
    lg: { radius: 60, strokeWidth: 8, fontSize: 'text-2xl' },
  };

  const config = sizeConfig[size];
  const circumference = 2 * Math.PI * config.radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circular Progress */}
      <div className="relative">
        <svg
          width={config.radius * 2 + config.strokeWidth * 2}
          height={config.radius * 2 + config.strokeWidth * 2}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.radius + config.strokeWidth}
            cy={config.radius + config.strokeWidth}
            r={config.radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.strokeWidth}
            className="text-muted"
            opacity={0.2}
          />

          {/* Progress circle */}
          <circle
            cx={config.radius + config.strokeWidth}
            cy={config.radius + config.strokeWidth}
            r={config.radius}
            fill="none"
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            className={cn('transition-all duration-500', getStrokeColor())}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>

        {/* Percentage Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', config.fontSize, getColor())}>
            {Math.round(percent)}%
          </span>
        </div>
      </div>

      {/* Label */}
      {showLabel && (
        <div className="text-sm text-center">
          <div className="font-medium">Profile Completeness</div>
          <div className="text-xs text-muted-foreground">
            {getStatusText(percent)}
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusText(percent: number): string {
  if (percent === 0) return 'Just getting started';
  if (percent < 30) return 'Early stages';
  if (percent < 50) return 'Making progress';
  if (percent < 70) return 'Looking good';
  if (percent < 90) return 'Almost there';
  if (percent < 100) return 'Nearly complete';
  return 'Complete!';
}
