'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelativeTime } from '@/lib/utils';
import { Clock, FolderKanban, MoreVertical, Eye, Edit, Archive, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    type: string;
    status: string;
    updatedAt: Date | string;
    companyProfile?: {
      name: string;
    } | null;
    _count?: {
      agentExecutions: number;
      workflowExecutions: number;
    };
  };
  onArchive?: (projectId: string) => void;
  onDelete?: (projectId: string) => void;
}

const statusVariants = {
  DRAFT: 'outline',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  FAILED: 'destructive',
  ARCHIVED: 'secondary',
} as const;

const statusLabels = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  ARCHIVED: 'Archived',
};

const typeLabels = {
  WEBSITE: 'Website',
  CONTENT: 'Content',
  SEO_AUDIT: 'SEO Audit',
  WORKFLOW: 'Workflow',
  DATA_PROCESSING: 'Data Processing',
  CUSTOMER_SERVICE: 'Customer Service',
};

export function ProjectCard({ project, onArchive, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const statusVariant = statusVariants[project.status as keyof typeof statusVariants] || 'outline';
  const statusLabel = statusLabels[project.status as keyof typeof statusLabels] || project.status;
  const typeLabel = typeLabels[project.type as keyof typeof typeLabels] || project.type;

  const handleAction = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <Card className="group h-full transition-all hover:shadow-lg hover:border-primary/50 relative">
      <Link href={`/dashboard/projects/${project.id}`} className="block h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <FolderKanban className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="truncate text-lg">{project.name}</CardTitle>
                {project.companyProfile && (
                  <p className="text-xs text-muted-foreground truncate">
                    {project.companyProfile.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusVariant}>{statusLabel}</Badge>
              <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={(e) => handleAction(e, () => router.push(`/dashboard/projects/${project.id}`))}>
                    <Eye className="mr-2 h-4 w-4" />
                    View project
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={(e) => handleAction(e, () => router.push(`/dashboard/projects/${project.id}/edit`))}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit project
                  </DropdownMenuItem>
                  {onArchive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => handleAction(e, () => onArchive(project.id))}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </>
                  )}
                  {onDelete && (
                    <DropdownMenuItem
                      onClick={(e) => handleAction(e, () => onDelete(project.id))}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="line-clamp-2 min-h-[2.5rem]">
            {project.description || 'No description provided'}
          </CardDescription>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatRelativeTime(project.updatedAt)}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {typeLabel}
            </Badge>
          </div>
        </CardContent>
        {project._count && (
          <CardFooter className="text-xs text-muted-foreground">
            <div className="flex gap-4">
              <span>{project._count.agentExecutions} agents</span>
              <span>{project._count.workflowExecutions} workflows</span>
            </div>
          </CardFooter>
        )}
      </Link>
    </Card>
  );
}
