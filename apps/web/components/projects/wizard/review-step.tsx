'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { useWizard } from './wizard-provider';
import { trpc } from '@/lib/trpc/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Globe,
  FileText,
  Search,
  Workflow,
  Database,
  HeadphonesIcon,
  Edit2,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import type { WizardFormData } from '@/lib/validations/wizard-schema';

const projectTypeIcons = {
  website: Globe,
  content: FileText,
  seo_audit: Search,
  workflow: Workflow,
  data_processing: Database,
  customer_service: HeadphonesIcon,
};

const projectTypeLabels = {
  website: 'Website',
  content: 'Content Generation',
  seo_audit: 'SEO Audit',
  workflow: 'Custom Workflow',
  data_processing: 'Data Processing',
  customer_service: 'Customer Service',
};

export function ReviewStep() {
  const { watch, setValue } = useFormContext<WizardFormData>();
  const { goToStep } = useWizard();

  const formData = watch();
  const termsAccepted = watch('termsAccepted');

  // Fetch company profiles to display selected one
  const { data: profilesData } = trpc.companyProfile.list.useQuery(
    { limit: 100 },
    { enabled: !!formData.companyProfileId }
  );

  const companyProfile = profilesData?.items.find(
    (p) => p.id === formData.companyProfileId
  );

  const TypeIcon = formData.type ? projectTypeIcons[formData.type] : Globe;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Review Your Project</h3>
        <p className="text-sm text-muted-foreground">
          Please review all the information below before creating your project
        </p>
      </div>

      {/* Project Type & Basic Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Project Details</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => goToStep(0)}>
            <Edit2 className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TypeIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Project Type</p>
              <p className="text-sm text-muted-foreground">
                {formData.type ? projectTypeLabels[formData.type] : 'Not selected'}
              </p>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div>
            <p className="text-sm font-medium mb-1">Project Name</p>
            <p className="text-sm text-muted-foreground">{formData.name || 'Not provided'}</p>
          </div>

          {/* Description */}
          {formData.description && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{formData.description}</p>
              </div>
            </>
          )}

          {/* Tags */}
          {formData.tags && formData.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Max Iterations */}
          <Separator />
          <div>
            <p className="text-sm font-medium mb-1">Maximum Iterations</p>
            <p className="text-sm text-muted-foreground">{formData.maxIterations || 3}</p>
          </div>
        </CardContent>
      </Card>

      {/* Company Profile */}
      {(formData.companyProfileId || formData.companyProfileData) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company Profile
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => goToStep(2)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {formData.companyProfileId && companyProfile ? (
              <>
                <div>
                  <p className="text-sm font-medium mb-1">Company Name</p>
                  <p className="text-sm text-muted-foreground">{companyProfile.name}</p>
                </div>
                {companyProfile.industry && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Industry</p>
                      <p className="text-sm text-muted-foreground">{companyProfile.industry}</p>
                    </div>
                  </>
                )}
              </>
            ) : formData.companyProfileData ? (
              <>
                <div>
                  <p className="text-sm font-medium mb-1">Company Name</p>
                  <p className="text-sm text-muted-foreground">
                    {formData.companyProfileData.name || 'Not provided'}
                  </p>
                </div>
                {formData.companyProfileData.industry && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Industry</p>
                      <p className="text-sm text-muted-foreground">{formData.companyProfileData.industry}</p>
                    </div>
                  </>
                )}
                {formData.companyProfileData.email && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Email</p>
                      <p className="text-sm text-muted-foreground">{formData.companyProfileData.email}</p>
                    </div>
                  </>
                )}
                {formData.companyProfileData.website && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-medium mb-1">Website</p>
                      <p className="text-sm text-muted-foreground">{formData.companyProfileData.website}</p>
                    </div>
                  </>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Discovery Data */}
      {formData.discoveryData && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Discovery Data</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Completeness</p>
              <Badge variant="secondary">{formData.discoveryData.completeness || 0}%</Badge>
            </div>

            {formData.discoveryData.businessInfo?.targetAudience && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-1">Target Audience</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {formData.discoveryData.businessInfo.targetAudience}
                  </p>
                </div>
              </>
            )}

            {formData.discoveryData.services?.offerings &&
              formData.discoveryData.services.offerings.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Services</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.discoveryData.services.offerings.slice(0, 3).map((offering) => (
                        <Badge key={offering} variant="outline">
                          {offering}
                        </Badge>
                      ))}
                      {formData.discoveryData.services.offerings.length > 3 && (
                        <Badge variant="outline">
                          +{formData.discoveryData.services.offerings.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}

            {formData.discoveryData.brandIdentity?.primaryColor && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Brand Colors</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: formData.discoveryData.brandIdentity.primaryColor }}
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.discoveryData.brandIdentity.primaryColor}
                    </span>
                  </div>
                </div>
              </>
            )}

            {formData.discoveryData.seoStrategy?.targetKeywords &&
              formData.discoveryData.seoStrategy.targetKeywords.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-2">Target Keywords</p>
                    <div className="flex flex-wrap gap-2">
                      {formData.discoveryData.seoStrategy.targetKeywords.slice(0, 3).map((keyword) => (
                        <Badge key={keyword} variant="outline">
                          {keyword}
                        </Badge>
                      ))}
                      {formData.discoveryData.seoStrategy.targetKeywords.length > 3 && (
                        <Badge variant="outline">
                          +{formData.discoveryData.seoStrategy.targetKeywords.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              )}
          </CardContent>
        </Card>
      )}

      {/* Terms & Conditions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="termsAccepted"
              checked={termsAccepted || false}
              onCheckedChange={(checked) => setValue('termsAccepted', checked as boolean, { shouldDirty: true })}
            />
            <div className="flex-1">
              <Label htmlFor="termsAccepted" className="cursor-pointer text-sm leading-relaxed">
                I confirm that all the information provided is accurate and I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Action */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium mb-1">Ready to Create Your Project?</p>
              <p className="text-sm text-muted-foreground">
                Click the &quot;Create Project&quot; button below to finalize your project. AI agents will begin working on
                your project immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
