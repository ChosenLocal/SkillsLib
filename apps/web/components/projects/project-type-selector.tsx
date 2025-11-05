'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, FileText, Search, Workflow, Database, HeadphonesIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectTypeSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const projectTypes = [
  {
    id: 'website',
    label: 'Website',
    description: 'Build complete websites with AI-powered agents',
    icon: Globe,
  },
  {
    id: 'content',
    label: 'Content Generation',
    description: 'Create blog posts, articles, and marketing copy',
    icon: FileText,
  },
  {
    id: 'seo_audit',
    label: 'SEO Audit',
    description: 'Analyze and optimize website SEO performance',
    icon: Search,
  },
  {
    id: 'workflow',
    label: 'Custom Workflow',
    description: 'Design custom automation workflows',
    icon: Workflow,
  },
  {
    id: 'data_processing',
    label: 'Data Processing',
    description: 'Process and transform data automatically',
    icon: Database,
  },
  {
    id: 'customer_service',
    label: 'Customer Service',
    description: 'Automate customer support interactions',
    icon: HeadphonesIcon,
  },
];

export function ProjectTypeSelector({ value, onChange }: ProjectTypeSelectorProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projectTypes.map((type) => {
        const Icon = type.icon;
        const isSelected = value === type.id;

        return (
          <Card
            key={type.id}
            className={cn(
              'cursor-pointer transition-all hover:border-primary/50',
              isSelected && 'border-primary bg-primary/5'
            )}
            onClick={() => onChange(type.id)}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{type.label}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription>{type.description}</CardDescription>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
