'use client';

import * as React from 'react';
import { useWizard } from './wizard-provider';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export function ProgressIndicator() {
  const { steps, currentStep, goToStep, canGoToStep } = useWizard();

  return (
    <nav aria-label="Progress" className="px-4 py-6">
      {/* Mobile: Simple progress bar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">
            Step {currentStep + 1} of {steps.length}
          </p>
          <p className="text-sm text-muted-foreground">{steps[currentStep]?.title}</p>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop: Step indicators */}
      <ol className="hidden md:flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isAccessible = canGoToStep(index);

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'absolute top-5 left-[calc(50%+1rem)] right-[calc(-50%+1rem)] h-0.5 transition-colors',
                    isCompleted ? 'bg-primary' : 'bg-border'
                  )}
                  aria-hidden="true"
                />
              )}

              {/* Step button */}
              <button
                type="button"
                onClick={() => isAccessible && goToStep(index)}
                disabled={!isAccessible}
                className={cn(
                  'relative flex flex-col items-center group w-full',
                  isAccessible ? 'cursor-pointer' : 'cursor-not-allowed'
                )}
              >
                {/* Step circle */}
                <span
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all',
                    isCompleted && 'border-primary bg-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-background text-primary scale-110',
                    !isCompleted && !isCurrent && 'border-border bg-background text-muted-foreground',
                    isAccessible && !isCurrent && 'group-hover:border-primary group-hover:scale-105'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </span>

                {/* Step label */}
                <span className="mt-2 block">
                  <span
                    className={cn(
                      'text-sm font-medium block',
                      isCurrent && 'text-foreground',
                      isCompleted && 'text-foreground',
                      !isCompleted && !isCurrent && 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-muted-foreground hidden lg:block mt-1 max-w-[120px] text-center">
                    {step.description}
                  </span>
                </span>

                {/* Optional badge */}
                {step.optional && (
                  <span className="absolute -top-1 -right-1 bg-secondary text-secondary-foreground text-xs px-1.5 py-0.5 rounded-full">
                    Optional
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
