'use client';

import * as React from 'react';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { WizardFormData } from '@/lib/validations/wizard-schema';

export function BasicInfoStep() {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
  } = useFormContext<WizardFormData>();

  const [tagInput, setTagInput] = React.useState('');
  const tags = watch('tags') || [];
  const maxIterations = watch('maxIterations') || 3;

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setValue('tags', [...tags, tagInput.trim()], { shouldDirty: true });
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue(
      'tags',
      tags.filter((tag: string) => tag !== tagToRemove),
      { shouldDirty: true }
    );
  };

  return (
    <div className="space-y-6">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="name">
          Project Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="My Awesome Project"
          {...register('name')}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Choose a clear, descriptive name for your project (max 100 characters)
        </p>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your project goals and requirements..."
          rows={4}
          {...register('description')}
          className={errors.description ? 'border-destructive' : ''}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Provide context to help AI agents understand your project (max 500 characters)
        </p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          placeholder="Press Enter to add tags (e.g., marketing, ecommerce)"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
        />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {tags.map((tag: string) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Add tags to organize and categorize your project
        </p>
      </div>

      {/* Max Iterations */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="maxIterations">Maximum Iterations</Label>
            <span className="text-sm font-medium">{maxIterations}</span>
          </div>
          <Slider
            id="maxIterations"
            min={1}
            max={10}
            step={1}
            value={[maxIterations]}
            onValueChange={(value: number[]) =>
              setValue('maxIterations', value[0] || 3, { shouldDirty: true })
            }
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Control how many refinement cycles agents can perform (1-10)
          </p>
        </div>

        <div className="bg-muted/50 border rounded-lg p-4">
          <h4 className="text-sm font-medium mb-2">Iteration Guide</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>
              <strong>1-3 iterations:</strong> Quick tasks with minimal refinement
            </li>
            <li>
              <strong>4-6 iterations:</strong> Standard projects with moderate complexity
            </li>
            <li>
              <strong>7-10 iterations:</strong> Complex projects requiring extensive refinement
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
