'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc/react';
import { useWizardDraft } from '@/lib/hooks/use-wizard-draft';
import {
  wizardFormSchema,
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  type WizardFormData,
} from '@/lib/validations/wizard-schema';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  schema: any;
  optional?: boolean;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'type',
    title: 'Project Type',
    description: 'Choose the type of project you want to create',
    schema: step1Schema,
  },
  {
    id: 'info',
    title: 'Basic Information',
    description: 'Provide project name and details',
    schema: step2Schema,
  },
  {
    id: 'company',
    title: 'Company Profile',
    description: 'Select or create a company profile',
    schema: step3Schema,
    optional: true,
  },
  {
    id: 'discovery',
    title: 'Discovery Data',
    description: 'Collect project requirements and details',
    schema: step4Schema,
    optional: true,
  },
  {
    id: 'review',
    title: 'Review & Confirm',
    description: 'Review all information and submit',
    schema: step5Schema,
  },
];

interface WizardContextValue {
  currentStep: number;
  steps: WizardStep[];
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  nextStep: () => Promise<boolean>;
  previousStep: () => void;
  saveDraft: () => void;
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  canGoToStep: (step: number) => boolean;
  submitWizard: () => Promise<void>;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

export function useWizard() {
  const context = React.useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
}

interface WizardProviderProps {
  children: React.ReactNode;
  tenantId?: string;
}

export function WizardProvider({ children, tenantId }: WizardProviderProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(0);
  const [isSaving, setIsSaving] = React.useState(false);
  const [completedSteps, setCompletedSteps] = React.useState<Set<number>>(new Set());

  const draftManager = useWizardDraft(tenantId);
  const utils = trpc.useUtils();

  // Initialize form with React Hook Form
  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardFormSchema) as any,
    mode: 'onChange',
    defaultValues: {
      type: undefined,
      name: '',
      description: '',
      tags: [],
      maxIterations: 3,
      discoveryData: undefined,
    },
  });

  const {
    formState: { isDirty },
    watch,
    trigger,
  } = form;

  // Load draft on mount
  React.useEffect(() => {
    if (!draftManager.isLoading && draftManager.hasDraft()) {
      const draft = draftManager.loadDraft();
      if (draft) {
        // Restore form data
        Object.entries(draft.data).forEach(([key, value]) => {
          form.setValue(key as any, value as any, { shouldDirty: false });
        });
        // Restore current step
        setCurrentStep(draft.metadata.currentStep);
        // Mark previous steps as completed
        const completed = new Set<number>();
        for (let i = 0; i < draft.metadata.currentStep; i++) {
          completed.add(i);
        }
        setCompletedSteps(completed);
        toast.info('Draft restored', {
          description: 'Your previous work has been recovered.',
        });
      }
    }
  }, [draftManager, form]);

  // Auto-save draft (debounced)
  React.useEffect(() => {
    const subscription = watch(() => {
      if (isDirty) {
        const timeoutId = setTimeout(() => {
          saveDraft();
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
      }
      return undefined;
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch, isDirty]);

  // tRPC mutations
  const createProjectMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      toast.success('Project created successfully!');
      draftManager.deleteDraft();
      utils.project.list.invalidate();
      router.push(`/dashboard/projects/${project.id}`);
    },
    onError: (error) => {
      toast.error('Failed to create project', {
        description: error.message,
      });
    },
  });

  const createCompanyProfileMutation = trpc.companyProfile.create.useMutation({
    onSuccess: (profile) => {
      toast.success('Company profile created');
      form.setValue('companyProfileId', profile.id);
    },
    onError: (error) => {
      toast.error('Failed to create company profile', {
        description: error.message,
      });
    },
  });

  /**
   * Save draft to localStorage
   */
  const saveDraft = React.useCallback(() => {
    setIsSaving(true);
    const data = form.getValues();
    const success = draftManager.saveDraft(data, currentStep);
    setIsSaving(false);

    if (!success) {
      toast.error('Failed to save draft');
    }
  }, [form, currentStep, draftManager]);

  /**
   * Validate current step
   */
  const validateStep = React.useCallback(
    async (step: number): Promise<boolean> => {
      const currentStepDef = WIZARD_STEPS[step];
      if (!currentStepDef) return false;

      // Get fields for current step
      let fieldsToValidate: (keyof WizardFormData)[] = [];

      switch (step) {
        case 0: // Type
          fieldsToValidate = ['type'];
          break;
        case 1: // Basic Info
          fieldsToValidate = ['name', 'description', 'tags', 'maxIterations'];
          break;
        case 2: // Company Profile (optional)
          if (currentStepDef.optional) return true;
          fieldsToValidate = ['companyProfileId'];
          break;
        case 3: // Discovery (optional)
          if (currentStepDef.optional) return true;
          break;
        case 4: // Review
          // Validate entire form
          return await trigger();
      }

      // Trigger validation for specific fields
      const result = await trigger(fieldsToValidate as any);
      return result;
    },
    [trigger]
  );

  /**
   * Navigate to specific step
   */
  const goToStep = React.useCallback(
    (step: number) => {
      if (step < 0 || step >= WIZARD_STEPS.length) return;
      if (step > currentStep && !completedSteps.has(currentStep)) {
        toast.error('Please complete the current step first');
        return;
      }
      setCurrentStep(step);
      saveDraft();
    },
    [currentStep, completedSteps, saveDraft]
  );

  /**
   * Move to next step
   */
  const nextStep = React.useCallback(async (): Promise<boolean> => {
    const isValid = await validateStep(currentStep);

    if (!isValid) {
      toast.error('Please complete all required fields');
      return false;
    }

    // Mark current step as completed
    setCompletedSteps((prev) => new Set(prev).add(currentStep));

    // Move to next step
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
      saveDraft();
      return true;
    }

    return false;
  }, [currentStep, validateStep, saveDraft]);

  /**
   * Move to previous step
   */
  const previousStep = React.useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      saveDraft();
    }
  }, [currentStep, saveDraft]);

  /**
   * Check if can navigate to step
   */
  const canGoToStep = React.useCallback(
    (step: number): boolean => {
      if (step < 0 || step >= WIZARD_STEPS.length) return false;
      if (step <= currentStep) return true;
      // Can only go forward if previous steps are completed
      for (let i = 0; i < step; i++) {
        if (!completedSteps.has(i)) return false;
      }
      return true;
    },
    [currentStep, completedSteps]
  );

  /**
   * Submit wizard and create project
   */
  const submitWizard = React.useCallback(async () => {
    // Final validation
    const isValid = await trigger();
    if (!isValid) {
      toast.error('Please fix validation errors');
      return;
    }

    const data = form.getValues();

    // Create company profile first if needed
    if (data.companyProfileData && !data.companyProfileId) {
      await createCompanyProfileMutation.mutateAsync(data.companyProfileData as any);
      // companyProfileId is set by the mutation's onSuccess
    }

    // Create project
    await createProjectMutation.mutateAsync({
      name: data.name!,
      description: data.description,
      type: data.type!,
      companyProfileId: data.companyProfileId,
      tags: data.tags,
      discoveryData: data.discoveryData as any,
      maxIterations: data.maxIterations,
    });
  }, [form, trigger, createProjectMutation, createCompanyProfileMutation]);

  const value: WizardContextValue = {
    currentStep,
    steps: WIZARD_STEPS,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === WIZARD_STEPS.length - 1,
    goToStep,
    nextStep,
    previousStep,
    saveDraft,
    isDirty,
    isSaving,
    lastSaved: draftManager.lastSaved,
    canGoToStep,
    submitWizard,
  };

  return (
    <WizardContext.Provider value={value}>
      <FormProvider {...form}>{children}</FormProvider>
    </WizardContext.Provider>
  );
}
