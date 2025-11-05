'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus } from 'lucide-react';
import type { WizardFormData } from '@/lib/validations/wizard-schema';

export function DiscoveryDataStep() {
  const { register, watch, setValue } = useFormContext<WizardFormData>();

  // Watch all discovery data fields
  const discoveryData = watch('discoveryData');

  // State for array inputs
  const [newOffering, setNewOffering] = React.useState('');
  const [newKeyword, setNewKeyword] = React.useState('');
  const [newCompetitor, setNewCompetitor] = React.useState('');
  const [newSecondaryColor, setNewSecondaryColor] = React.useState('');
  const [newIntegration, setNewIntegration] = React.useState('');
  const [newLicense, setNewLicense] = React.useState('');

  // Calculate completeness
  const calculateCompleteness = React.useMemo(() => {
    if (!discoveryData) return 0;

    const fields = [
      discoveryData.businessInfo?.targetAudience,
      discoveryData.businessInfo?.uniqueValue,
      discoveryData.businessInfo?.businessGoals,
      discoveryData.services?.offerings?.length,
      discoveryData.services?.pricing,
      discoveryData.brandIdentity?.primaryColor,
      discoveryData.brandIdentity?.brandVoice,
      discoveryData.seoStrategy?.targetKeywords?.length,
      discoveryData.contentAssets?.existingContent?.length,
      discoveryData.technicalRequirements?.hosting,
    ];

    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  }, [discoveryData]);

  React.useEffect(() => {
    setValue('discoveryData.completeness', calculateCompleteness);
  }, [calculateCompleteness, setValue]);

  // Helper functions for array management
  const addToArray = (path: string, value: string, setter: (val: string) => void) => {
    if (!value.trim()) return;
    const current = (watch(path as any) as string[]) || [];
    setValue(path as any, [...current, value.trim()], { shouldDirty: true });
    setter('');
  };

  const removeFromArray = (path: string, index: number) => {
    const current = (watch(path as any) as string[]) || [];
    setValue(
      path as any,
      current.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
  };

  const handleSkip = () => {
    setValue('discoveryData', undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium mb-2">Discovery Data (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Provide detailed information to guide AI agents in building your project
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSkip}>
          Skip This Step
        </Button>
      </div>

      {/* Completeness Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Completeness</Label>
          <span className="text-sm font-medium">{calculateCompleteness}%</span>
        </div>
        <Progress value={calculateCompleteness} className="h-2" />
      </div>

      <Accordion type="multiple" className="w-full">
        {/* Business Information */}
        <AccordionItem value="business">
          <AccordionTrigger>Business Information</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="targetAudience">Target Audience</Label>
              <Textarea
                id="targetAudience"
                placeholder="Who are your ideal customers?"
                {...register('discoveryData.businessInfo.targetAudience')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uniqueValue">Unique Value Proposition</Label>
              <Textarea
                id="uniqueValue"
                placeholder="What makes your business unique?"
                {...register('discoveryData.businessInfo.uniqueValue')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessGoals">Business Goals</Label>
              <Textarea
                id="businessGoals"
                placeholder="What are you trying to achieve?"
                {...register('discoveryData.businessInfo.businessGoals')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="challenges">Current Challenges</Label>
              <Textarea
                id="challenges"
                placeholder="What problems are you facing?"
                {...register('discoveryData.businessInfo.challenges')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Services */}
        <AccordionItem value="services">
          <AccordionTrigger>Services & Offerings</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Service Offerings</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a service..."
                  value={newOffering}
                  onChange={(e) => setNewOffering(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('discoveryData.services.offerings', newOffering, setNewOffering);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray('discoveryData.services.offerings', newOffering, setNewOffering)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watch('discoveryData.services.offerings') || []).map((offering, idx) => (
                  <Badge key={idx} variant="secondary">
                    {offering}
                    <button
                      type="button"
                      onClick={() => removeFromArray('discoveryData.services.offerings', idx)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricing">Pricing Model</Label>
              <Input
                id="pricing"
                placeholder="e.g., Subscription, One-time, Custom"
                {...register('discoveryData.services.pricing')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="process">Service Process</Label>
              <Textarea
                id="process"
                placeholder="How do you deliver your services?"
                {...register('discoveryData.services.process')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliverables">Deliverables</Label>
              <Textarea
                id="deliverables"
                placeholder="What do customers receive?"
                {...register('discoveryData.services.deliverables')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Brand Identity */}
        <AccordionItem value="brand">
          <AccordionTrigger>Brand Identity</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    {...register('discoveryData.brandIdentity.primaryColor')}
                    className="w-20 h-10"
                  />
                  <Input
                    placeholder="#000000"
                    {...register('discoveryData.brandIdentity.primaryColor')}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secondary Colors</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="#FFFFFF"
                    value={newSecondaryColor}
                    onChange={(e) => setNewSecondaryColor(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() =>
                      addToArray('discoveryData.brandIdentity.secondaryColors', newSecondaryColor, setNewSecondaryColor)
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(watch('discoveryData.brandIdentity.secondaryColors') || []).map((color, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-2">
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color }}
                      />
                      {color}
                      <button
                        type="button"
                        onClick={() => removeFromArray('discoveryData.brandIdentity.secondaryColors', idx)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brandVoice">Brand Voice</Label>
              <Textarea
                id="brandVoice"
                placeholder="Professional, casual, friendly, authoritative..."
                {...register('discoveryData.brandIdentity.brandVoice')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="styleGuide">Style Guide Notes</Label>
              <Textarea
                id="styleGuide"
                placeholder="Typography, spacing, imagery preferences..."
                {...register('discoveryData.brandIdentity.styleGuide')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                placeholder="https://example.com/logo.png"
                {...register('discoveryData.brandIdentity.logoUrl')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* SEO Strategy */}
        <AccordionItem value="seo">
          <AccordionTrigger>SEO Strategy</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Target Keywords</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a keyword..."
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('discoveryData.seoStrategy.targetKeywords', newKeyword, setNewKeyword);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray('discoveryData.seoStrategy.targetKeywords', newKeyword, setNewKeyword)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watch('discoveryData.seoStrategy.targetKeywords') || []).map((keyword, idx) => (
                  <Badge key={idx} variant="secondary">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeFromArray('discoveryData.seoStrategy.targetKeywords', idx)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Competitors</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a competitor..."
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('discoveryData.seoStrategy.competitors', newCompetitor, setNewCompetitor);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray('discoveryData.seoStrategy.competitors', newCompetitor, setNewCompetitor)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watch('discoveryData.seoStrategy.competitors') || []).map((competitor, idx) => (
                  <Badge key={idx} variant="secondary">
                    {competitor}
                    <button
                      type="button"
                      onClick={() => removeFromArray('discoveryData.seoStrategy.competitors', idx)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rankingGoals">Ranking Goals</Label>
              <Textarea
                id="rankingGoals"
                placeholder="What search rankings are you targeting?"
                {...register('discoveryData.seoStrategy.rankingGoals')}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="localSEO"
                checked={watch('discoveryData.seoStrategy.localSEO') || false}
                onCheckedChange={(checked) =>
                  setValue('discoveryData.seoStrategy.localSEO', checked as boolean, { shouldDirty: true })
                }
              />
              <Label htmlFor="localSEO" className="cursor-pointer">
                Focus on Local SEO
              </Label>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Technical Requirements */}
        <AccordionItem value="technical">
          <AccordionTrigger>Technical Requirements</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="hosting">Hosting Preferences</Label>
              <Input
                id="hosting"
                placeholder="e.g., AWS, Vercel, Netlify"
                {...register('discoveryData.technicalRequirements.hosting')}
              />
            </div>

            <div className="space-y-2">
              <Label>Required Integrations</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add an integration..."
                  value={newIntegration}
                  onChange={(e) => setNewIntegration(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('discoveryData.technicalRequirements.integrations', newIntegration, setNewIntegration);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() =>
                    addToArray('discoveryData.technicalRequirements.integrations', newIntegration, setNewIntegration)
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watch('discoveryData.technicalRequirements.integrations') || []).map((integration, idx) => (
                  <Badge key={idx} variant="secondary">
                    {integration}
                    <button
                      type="button"
                      onClick={() => removeFromArray('discoveryData.technicalRequirements.integrations', idx)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialFeatures">Special Features</Label>
              <Textarea
                id="specialFeatures"
                placeholder="Any specific features or functionality needed?"
                {...register('discoveryData.technicalRequirements.specialFeatures')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="performance">Performance Requirements</Label>
              <Textarea
                id="performance"
                placeholder="Loading speed, scalability, etc."
                {...register('discoveryData.technicalRequirements.performance')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Legal Compliance */}
        <AccordionItem value="legal">
          <AccordionTrigger>Legal & Compliance</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="disclaimers">Legal Disclaimers</Label>
              <Textarea
                id="disclaimers"
                placeholder="Required legal disclaimers..."
                {...register('discoveryData.legalCompliance.disclaimers')}
              />
            </div>

            <div className="space-y-2">
              <Label>Licenses & Certifications</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a license..."
                  value={newLicense}
                  onChange={(e) => setNewLicense(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addToArray('discoveryData.legalCompliance.licenses', newLicense, setNewLicense);
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => addToArray('discoveryData.legalCompliance.licenses', newLicense, setNewLicense)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(watch('discoveryData.legalCompliance.licenses') || []).map((license, idx) => (
                  <Badge key={idx} variant="secondary">
                    {license}
                    <button
                      type="button"
                      onClick={() => removeFromArray('discoveryData.legalCompliance.licenses', idx)}
                      className="ml-2 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="privacyPolicy">Privacy Policy Notes</Label>
              <Textarea
                id="privacyPolicy"
                placeholder="Key privacy considerations..."
                {...register('discoveryData.legalCompliance.privacyPolicy')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Terms of Service Notes</Label>
              <Textarea
                id="terms"
                placeholder="Key terms and conditions..."
                {...register('discoveryData.legalCompliance.terms')}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
