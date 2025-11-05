'use client';

import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { trpc } from '@/lib/trpc/react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WizardFormData } from '@/lib/validations/wizard-schema';

export function CompanyProfileStep() {
  const {
    register,
    formState: { errors },
    setValue,
    control,
  } = useFormContext<WizardFormData>();

  const [mode, setMode] = React.useState<'select' | 'create'>('select');

  // Fetch company profiles
  const { data: profiles, isLoading } = trpc.companyProfile.list.useQuery({
    limit: 100,
  });

  const handleModeChange = (newMode: string) => {
    setMode(newMode as 'select' | 'create');
    // Clear the other field when switching modes
    if (newMode === 'select') {
      setValue('companyProfileData', undefined);
    } else {
      setValue('companyProfileId', undefined);
    }
  };

  const handleSkip = () => {
    setValue('companyProfileId', undefined);
    setValue('companyProfileData', undefined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium mb-2">Company Profile (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Link this project to a company profile to provide context for AI agents
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSkip}>
          Skip This Step
        </Button>
      </div>

      <Tabs value={mode} onValueChange={handleModeChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="select">Select Existing</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        {/* Select Existing Profile */}
        <TabsContent value="select" className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles && profiles.items.length > 0 ? (
            <div className="space-y-2">
              <Label htmlFor="companyProfileId">Select Company Profile</Label>
              <Controller
                name="companyProfileId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ''} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a company profile..." />
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.items.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {profile.name}
                            {profile.industry && (
                              <span className="text-xs text-muted-foreground">
                                • {profile.industry}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.companyProfileId && (
                <p className="text-sm text-destructive">{errors.companyProfileId.message}</p>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  No company profiles found. Create one in the next tab.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Create New Profile */}
        <TabsContent value="create" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Company Name */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyProfileData.name">
                Company Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyProfileData.name"
                placeholder="Acme Corporation"
                {...register('companyProfileData.name')}
                className={errors.companyProfileData?.name ? 'border-destructive' : ''}
              />
              {errors.companyProfileData?.name && (
                <p className="text-sm text-destructive">
                  {errors.companyProfileData.name.message as string}
                </p>
              )}
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label htmlFor="companyProfileData.industry">Industry</Label>
              <Input
                id="companyProfileData.industry"
                placeholder="Technology, Healthcare, etc."
                {...register('companyProfileData.industry')}
              />
            </div>

            {/* Tagline */}
            <div className="space-y-2">
              <Label htmlFor="companyProfileData.tagline">Tagline</Label>
              <Input
                id="companyProfileData.tagline"
                placeholder="Making the world better"
                {...register('companyProfileData.tagline')}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="companyProfileData.email">Email</Label>
              <Input
                id="companyProfileData.email"
                type="email"
                placeholder="contact@company.com"
                {...register('companyProfileData.email')}
                className={errors.companyProfileData?.email ? 'border-destructive' : ''}
              />
              {errors.companyProfileData?.email && (
                <p className="text-sm text-destructive">
                  {errors.companyProfileData.email.message as string}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="companyProfileData.phone">Phone</Label>
              <Input
                id="companyProfileData.phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                {...register('companyProfileData.phone')}
              />
            </div>

            {/* Website */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyProfileData.website">Website</Label>
              <Input
                id="companyProfileData.website"
                type="url"
                placeholder="https://www.company.com"
                {...register('companyProfileData.website')}
                className={errors.companyProfileData?.website ? 'border-destructive' : ''}
              />
              {errors.companyProfileData?.website && (
                <p className="text-sm text-destructive">
                  {errors.companyProfileData.website.message as string}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="companyProfileData.address">Address</Label>
              <Input
                id="companyProfileData.address"
                placeholder="123 Main St, City, State, Country"
                {...register('companyProfileData.address')}
              />
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-4">
            <p className="text-xs text-muted-foreground">
              This profile will be created when you submit the wizard and can be reused for future
              projects.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
