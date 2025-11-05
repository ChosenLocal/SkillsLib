'use client';

import { WizardProvider, useWizard } from '@/components/projects/wizard/wizard-provider';
import { WizardLayout } from '@/components/projects/wizard/wizard-layout';
import { ProjectTypeStep } from '@/components/projects/wizard/project-type-step';
import { BasicInfoStep } from '@/components/projects/wizard/basic-info-step';
import { CompanyProfileStep } from '@/components/projects/wizard/company-profile-step';
import { DiscoveryDataStep } from '@/components/projects/wizard/discovery-data-step';
import { ReviewStep } from '@/components/projects/wizard/review-step';

function WizardSteps() {
  const { currentStep } = useWizard();

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <ProjectTypeStep />;
      case 1:
        return <BasicInfoStep />;
      case 2:
        return <CompanyProfileStep />;
      case 3:
        return <DiscoveryDataStep />;
      case 4:
        return <ReviewStep />;
      default:
        return <ProjectTypeStep />;
    }
  };

  return <WizardLayout>{renderStep()}</WizardLayout>;
}

export default function NewProjectPage() {
  return (
    <WizardProvider>
      <WizardSteps />
    </WizardProvider>
  );
}
