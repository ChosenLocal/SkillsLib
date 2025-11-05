'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ProjectFilters } from '@/components/projects/project-filters';
import { ProjectsGrid } from '@/components/projects/projects-grid';
import { ProjectsTable } from '@/components/projects/projects-table';
import { PaginationControls } from '@/components/projects/pagination-controls';
import { BulkActionsBar } from '@/components/projects/bulk-actions-bar';
import { CreateProjectModal } from '@/components/projects/create-project-modal';
import { ColumnToggle } from '@/components/projects/column-toggle';
import { trpc } from '@/lib/trpc/react';
import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'grid' | 'table';

export default function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([undefined]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('projects-view-mode');
    if (savedView === 'table' || savedView === 'grid') {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('projects-view-mode', mode);
  };

  const { data, isLoading, refetch } = trpc.project.list.useQuery({
    limit: pageSize,
    cursor: cursorHistory[currentPage - 1],
    filters: {
      search: search || undefined,
      status: status !== 'all' ? (status as any) : undefined,
      type: type !== 'all' ? (type as any) : undefined,
    },
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success('Project(s) deleted successfully');
      refetch();
      setRowSelection({});
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to delete project(s)');
    },
  });

  const updateStatusMutation = trpc.project.updateStatus.useMutation({
    onSuccess: () => {
      toast.success('Project(s) archived successfully');
      refetch();
      setRowSelection({});
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to archive project(s)');
    },
  });

  const projects = data?.items || [];
  const hasNextPage = !!data?.nextCursor;
  const hasPreviousPage = currentPage > 1;

  // Convert row selection indices to project IDs
  const selectedProjectIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map((index) => projects[parseInt(index)]?.id)
    .filter(Boolean) as string[];

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setType('all');
    setCurrentPage(1);
    setCursorHistory([undefined]);
  };

  const handlePageChange = (direction: 'next' | 'previous') => {
    if (direction === 'next' && hasNextPage) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      // Add next cursor to history if not already there
      if (!cursorHistory[newPage - 1]) {
        setCursorHistory([...cursorHistory, data?.nextCursor]);
      }
    } else if (direction === 'previous' && hasPreviousPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setCursorHistory([undefined]);
  };

  const handleBulkDelete = async (ids: string[]) => {
    for (const id of ids) {
      await deleteMutation.mutateAsync({ id });
    }
  };

  const handleBulkArchive = async (ids: string[]) => {
    for (const id of ids) {
      await updateStatusMutation.mutateAsync({ id, status: 'ARCHIVED' });
    }
  };

  const handleExport = (ids: string[]) => {
    const selectedData = projects.filter((p) => ids.includes(p.id));
    const csv = [
      ['Name', 'Type', 'Status', 'Created', 'Updated'].join(','),
      ...selectedData.map((p) =>
        [
          `"${p.name}"`,
          p.type,
          p.status,
          new Date(p.createdAt).toLocaleDateString(),
          new Date(p.updatedAt).toLocaleDateString(),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `projects-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset pagination and selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setCursorHistory([undefined]);
    setRowSelection({});
  }, [search, status, type]);

  // Clear selection when changing pages
  useEffect(() => {
    setRowSelection({});
  }, [currentPage]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">
            Manage your automation projects and workflows
          </p>
        </div>
        <CreateProjectModal />
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <ProjectFilters
            search={search}
            status={status}
            type={type}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onTypeChange={setType}
            onClear={handleClearFilters}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewChange('grid')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="sr-only">Grid view</span>
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewChange('table')}
            className="h-8 w-8 p-0"
          >
            <TableIcon className="h-4 w-4" />
            <span className="sr-only">Table view</span>
          </Button>
        </div>
      </div>

      <BulkActionsBar
        selectedCount={selectedProjectIds.length}
        selectedIds={selectedProjectIds}
        onArchive={handleBulkArchive}
        onDelete={handleBulkDelete}
        onExport={handleExport}
        onClearSelection={() => setRowSelection({})}
      />

      {viewMode === 'grid' ? (
        <ProjectsGrid
          projects={projects}
          isLoading={isLoading}
          onArchive={async (id) => await updateStatusMutation.mutateAsync({ id, status: 'ARCHIVED' })}
          onDelete={async (id) => await deleteMutation.mutateAsync({ id })}
        />
      ) : (
        <ProjectsTable
          projects={projects}
          isLoading={isLoading}
          onDelete={async (id) => await deleteMutation.mutateAsync({ id })}
          onArchive={async (id) => await updateStatusMutation.mutateAsync({ id, status: 'ARCHIVED' })}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      {projects.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={projects.length}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
