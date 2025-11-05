'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onPageChange: (direction: 'next' | 'previous') => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
}

export function PaginationControls({
  currentPage,
  pageSize,
  totalItems,
  hasNextPage,
  hasPreviousPage,
  onPageChange,
  onPageSizeChange,
  isLoading,
}: PaginationControlsProps) {
  // Calculate range of items being displayed
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-2">
      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">Items per page</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalItems > 0 && (
          <div className="hidden sm:block whitespace-nowrap">
            Showing {startItem}-{endItem} of {totalItems} items
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange('previous')}
          disabled={!hasPreviousPage || isLoading}
          className="h-8 w-8 p-0"
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center text-sm font-medium min-w-[60px]">
          Page {currentPage}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange('next')}
          disabled={!hasNextPage || isLoading}
          className="h-8 w-8 p-0"
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
