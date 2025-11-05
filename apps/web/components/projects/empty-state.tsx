import { Button } from '@/components/ui/button';
import { FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="mt-6 text-lg font-semibold">No projects yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Get started by creating your first automation project. Build websites, generate content, and
        more with AI-powered workflows.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard/projects/new">
          <Plus className="mr-2 h-4 w-4" />
          Create Project
        </Link>
      </Button>
    </div>
  );
}
