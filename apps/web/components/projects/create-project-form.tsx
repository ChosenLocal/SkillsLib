'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProjectTypeSelector } from './project-type-selector';
import { trpc } from '@/lib/trpc/react';
import { projectFormSchema } from '@/lib/validations/project';
import type { ProjectFormData } from '@/lib/validations/project';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export function CreateProjectForm() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState<Partial<ProjectFormData>>({
    type: 'website',
    maxIterations: 3,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      // Invalidate projects list to refetch
      utils.project.list.invalidate();
      router.push(`/dashboard/projects/${project.id}`);
    },
    onError: (error) => {
      console.error('Failed to create project:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = projectFormSchema.safeParse(formData);

    if (!validation.success) {
      const newErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    createMutation.mutate(validation.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex items-center gap-4">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Project</h1>
          <p className="text-muted-foreground">
            Set up a new automation project
          </p>
        </div>
      </div>

      {createMutation.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {createMutation.error?.message || 'Failed to create project'}
          </AlertDescription>
        </Alert>
      )}

      {/* Project Type Selection */}
      <div className="space-y-4">
        <div>
          <Label>Project Type *</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Choose the type of project you want to create
          </p>
        </div>
        <ProjectTypeSelector
          value={formData.type || ''}
          onChange={(type) => setFormData({ ...formData, type: type as any })}
        />
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type}</p>
        )}
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Project Name *</Label>
          <Input
            id="name"
            placeholder="e.g., My Company Website"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (Optional)</Label>
          <Input
            id="description"
            placeholder="Brief description of your project"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <details className="space-y-4">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced Settings
        </summary>
        <div className="mt-4 space-y-4 border-l-2 pl-4">
          <div className="space-y-2">
            <Label htmlFor="maxIterations">Max Iterations</Label>
            <Input
              id="maxIterations"
              type="number"
              min="1"
              max="10"
              value={formData.maxIterations || 3}
              onChange={(e) =>
                setFormData({ ...formData, maxIterations: parseInt(e.target.value) })
              }
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of quality refinement iterations (1-10)
            </p>
          </div>
        </div>
      </details>

      {/* Submit */}
      <div className="flex gap-4">
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="min-w-[120px]"
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            'Create Project'
          )}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/projects">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
