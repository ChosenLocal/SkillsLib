'use client';

import { ProjectCard } from './project-card';
import { EmptyState } from './empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectsGridProps {
  projects: any[];
  isLoading?: boolean;
  onArchive?: (projectId: string) => void;
  onDelete?: (projectId: string) => void;
}

export function ProjectsGrid({ projects, isLoading, onArchive, onDelete }: ProjectsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
