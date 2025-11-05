'use client';

import * as React from 'react';
import { useWizard } from './wizard-provider';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, CheckCircle, Loader2 } from 'lucide-react';

export function StepNavigation() {
  const {
    isFirstStep,
    isLastStep,
    previousStep,
    nextStep,
    saveDraft,
    isSaving,
    lastSaved,
    submitWizard,
  } = useWizard();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);

  const handleNext = async () => {
    setIsNavigating(true);
    const success = await nextStep();
    setIsNavigating(false);
    return success;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitWizard();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format last saved time
  const formatLastSaved = () => {
    if (!lastSaved) return null;
    const now = new Date();
    const diff = now.getTime() - lastSaved.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 10) return 'Saved just now';
    if (seconds < 60) return `Saved ${seconds}s ago`;
    if (minutes < 60) return `Saved ${minutes}m ago`;
    return lastSaved.toLocaleTimeString();
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Right Arrow: Next step
      if (e.ctrlKey && e.key === 'ArrowRight' && !isLastStep && !isNavigating) {
        e.preventDefault();
        handleNext();
      }
      // Ctrl+Left Arrow: Previous step
      if (e.ctrlKey && e.key === 'ArrowLeft' && !isFirstStep) {
        e.preventDefault();
        previousStep();
      }
      // Ctrl+S: Save draft
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDraft();
      }
      // Ctrl+Enter: Submit (if on last step)
      if (e.ctrlKey && e.key === 'Enter' && isLastStep && !isSubmitting) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstStep, isLastStep, isNavigating, isSubmitting]);

  return (
    <div className="border-t bg-background py-4 px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Previous button */}
        <div>
          {!isFirstStep ? (
            <Button
              type="button"
              variant="outline"
              onClick={previousStep}
              disabled={isNavigating || isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
          ) : (
            <div /> // Spacer
          )}
        </div>

        {/* Center: Save status */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={saveDraft}
            disabled={isSaving}
            className="hidden sm:flex"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </>
            )}
          </Button>
          {lastSaved && !isSaving && (
            <p className="text-xs text-muted-foreground hidden md:block">{formatLastSaved()}</p>
          )}
        </div>

        {/* Right: Next/Submit button */}
        <div>
          {isLastStep ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isNavigating}
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleNext}
              disabled={isNavigating || isSubmitting}
              className="min-w-[100px]"
            >
              {isNavigating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Next
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile: Keyboard shortcuts hint */}
      <div className="hidden lg:block mt-2">
        <p className="text-xs text-center text-muted-foreground">
          <kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl</kbd> +{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">←</kbd> Previous •{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl</kbd> +{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">→</kbd> Next •{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">Ctrl</kbd> +{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded">S</kbd> Save
        </p>
      </div>
    </div>
  );
}
