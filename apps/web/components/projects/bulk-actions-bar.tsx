'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Archive, Download, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface BulkActionsBarProps {
  selectedCount: number;
  selectedIds: string[];
  onArchive?: (ids: string[]) => Promise<void>;
  onDelete?: (ids: string[]) => Promise<void>;
  onExport?: (ids: string[]) => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedCount,
  selectedIds,
  onArchive,
  onDelete,
  onExport,
  onClearSelection,
}: BulkActionsBarProps) {
  const [showArchiveDialog, setShowArchiveDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);

  const handleArchive = async () => {
    if (!onArchive) return;
    setIsProcessing(true);
    try {
      await onArchive(selectedIds);
      onClearSelection();
    } catch (error) {
      console.error('Failed to archive projects:', error);
    } finally {
      setIsProcessing(false);
      setShowArchiveDialog(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsProcessing(true);
    try {
      await onDelete(selectedIds);
      onClearSelection();
    } catch (error) {
      console.error('Failed to delete projects:', error);
    } finally {
      setIsProcessing(false);
      setShowDeleteDialog(false);
    }
  };

  const handleExport = () => {
    if (!onExport) return;
    onExport(selectedIds);
  };

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between rounded-lg border bg-muted/50 p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedCount} {selectedCount === 1 ? 'project' : 'projects'} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="h-8 px-2"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear selection</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onExport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-8"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              )}
              {onArchive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchiveDialog(true)}
                  className="h-8"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="h-8"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {selectedCount} project(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Archived projects will be hidden from the main view but can be restored later.
              This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isProcessing}
              className="bg-primary"
            >
              {isProcessing ? 'Archiving...' : 'Archive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} project(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected projects
              and all associated data including workflows, executions, and generated assets.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
