'use client';

import * as React from 'react';
import { useWizard } from './wizard-provider';
import { ProgressIndicator } from './progress-indicator';
import { StepNavigation } from './step-navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface WizardLayoutProps {
  children?: React.ReactNode;
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const { currentStep, steps } = useWizard();

  return (
    <div className="min-h-screen bg-background">
      {/* Header with progress */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto">
          <div className="px-4 py-4">
            <h1 className="text-2xl font-bold mb-2">Create New Project</h1>
            <p className="text-sm text-muted-foreground">
              Follow the steps to set up your new project
            </p>
          </div>
          <ProgressIndicator />
        </div>
      </div>

      {/* Main content area */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-card border rounded-lg shadow-sm"
          >
            {/* Step header */}
            <div className="border-b px-6 py-4">
              <h2 className="text-xl font-semibold">{steps[currentStep]?.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {steps[currentStep]?.description}
              </p>
            </div>

            {/* Step content */}
            <div className="px-6 py-6 min-h-[400px]">
              {children}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer with navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg">
        <StepNavigation />
      </div>

      {/* Spacer to prevent content from being hidden behind fixed footer */}
      <div className="h-32" />
    </div>
  );
}
