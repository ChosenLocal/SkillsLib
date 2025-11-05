'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProjectTypeSelector } from './project-type-selector';
import { trpc } from '@/lib/trpc/react';
import { projectFormSchema } from '@/lib/validations/project';
import type { ProjectFormData } from '@/lib/validations/project';
import { Loader2, Plus } from 'lucide-react';

interface CreateProjectModalProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function CreateProjectModal({ trigger, onSuccess }: CreateProjectModalProps) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [open, setOpen] = React.useState(false);
  const [formData, setFormData] = React.useState<Partial<ProjectFormData>>({
    type: 'website',
    maxIterations: 3,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      // Invalidate projects list to refetch
      utils.project.list.invalidate();

      // Reset form and close modal
      setFormData({ type: 'website', maxIterations: 3 });
      setErrors({});
      setOpen(false);

      // Call optional success callback or navigate to project
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/dashboard/projects/${project.id}`);
      }
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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setFormData({ type: 'website', maxIterations: 3 });
      setErrors({});
      createMutation.reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new automation project. Fill in the details below to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {createMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {createMutation.error?.message || 'Failed to create project'}
              </AlertDescription>
            </Alert>
          )}

          {/* Project Type Selection */}
          <div className="space-y-3">
            <div>
              <Label>Project Type *</Label>
              <p className="text-xs text-muted-foreground">
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

          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="modal-name">Project Name *</Label>
            <Input
              id="modal-name"
              placeholder="e.g., My Company Website"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="modal-description">Description (Optional)</Label>
            <Textarea
              id="modal-description"
              placeholder="Brief description of your project"
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Advanced Settings - Collapsible */}
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-medium hover:text-primary">
              Advanced Settings
            </summary>
            <div className="mt-3 space-y-3 border-l-2 pl-4">
              <div className="space-y-2">
                <Label htmlFor="modal-maxIterations">Max Iterations</Label>
                <Input
                  id="modal-maxIterations"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.maxIterations || 3}
                  onChange={(e) =>
                    setFormData({ ...formData, maxIterations: parseInt(e.target.value) })
                  }
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of quality refinement iterations (1-10)
                </p>
              </div>
            </div>
          </details>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
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
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
