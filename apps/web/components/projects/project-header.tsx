'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import { ArrowLeft, Play, Pause, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface ProjectHeaderProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    type: string;
    status: string;
    updatedAt: Date | string;
    companyProfile?: {
      name: string;
    } | null;
  };
}

const statusVariants = {
  DRAFT: 'outline',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  FAILED: 'destructive',
  ARCHIVED: 'secondary',
} as const;

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const statusVariant = statusVariants[project.status as keyof typeof statusVariants] || 'outline';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">{project.name}</h1>
            <Badge variant={statusVariant}>{project.status.replace('_', ' ')}</Badge>
          </div>
          {project.companyProfile && (
            <p className="text-muted-foreground">{project.companyProfile.name}</p>
          )}
        </div>
        <div className="flex gap-2">
          {project.status === 'DRAFT' && (
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Start Project
            </Button>
          )}
          {project.status === 'IN_PROGRESS' && (
            <>
              <Button variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Restart
              </Button>
            </>
          )}
        </div>
      </div>
      {project.description && (
        <p className="text-muted-foreground">{project.description}</p>
      )}
      <div className="text-sm text-muted-foreground">
        Last updated {formatRelativeTime(project.updatedAt)}
      </div>
    </div>
  );
}
