'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { ProjectTypeSelector } from '../project-type-selector';
import type { WizardFormData } from '@/lib/validations/wizard-schema';

export function ProjectTypeStep() {
  const { control, formState: { errors } } = useFormContext<WizardFormData>();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Choose Your Project Type</h3>
        <p className="text-sm text-muted-foreground">
          Select the type of project you want to create. This will determine the available features and
          workflow options.
        </p>
      </div>

      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <ProjectTypeSelector
            value={field.value || ''}
            onChange={field.onChange}
          />
        )}
      />

      {errors.type && (
        <p className="text-sm text-destructive">{errors.type.message}</p>
      )}

      <div className="bg-muted/50 border rounded-lg p-4 mt-6">
        <h4 className="text-sm font-medium mb-2">What happens next?</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Configure basic project details</li>
          <li>Optionally link a company profile</li>
          <li>Provide discovery data to guide AI agents</li>
          <li>Review and create your project</li>
        </ul>
      </div>
    </div>
  );
}
