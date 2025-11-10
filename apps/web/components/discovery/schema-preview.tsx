/**
 * Schema Preview Component
 *
 * Displays extracted schema data in a collapsible tree view.
 * Shows which sections are filled vs empty.
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SchemaPreviewProps {
  data: Record<string, any>;
  completeness: number;
}

const SCHEMA_SECTIONS = [
  { key: 'company', label: 'Company', icon: '🏢' },
  { key: 'brand', label: 'Brand', icon: '🎨' },
  { key: 'offerings', label: 'Offerings', icon: '📦' },
  { key: 'audience', label: 'Audience', icon: '👥' },
  { key: 'marketing', label: 'Marketing', icon: '📢' },
  { key: 'team', label: 'Team', icon: '👔' },
  { key: 'credibility', label: 'Credibility', icon: '⭐' },
  { key: 'website', label: 'Website', icon: '🌐' },
  { key: 'support', label: 'Support', icon: '💬' },
  { key: 'locations', label: 'Locations', icon: '📍' },
  { key: 'local', label: 'Local SEO', icon: '🔍' },
  { key: 'compliance', label: 'Compliance', icon: '⚖️' },
];

export function SchemaPreview({ data, completeness }: SchemaPreviewProps) {
  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-lg">Collected Data</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {completeness}% complete
        </p>
      </div>

      {/* Sections */}
      <ScrollArea className="h-[calc(100vh-300px)]">
        <div className="p-2">
          {SCHEMA_SECTIONS.map((section) => (
            <SchemaSection
              key={section.key}
              section={section}
              data={data[section.key]}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface SchemaSectionProps {
  section: { key: string; label: string; icon: string };
  data: any;
}

function SchemaSection({ section, data }: SchemaSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Check if section has data
  const hasData = data && Object.keys(data).length > 0;
  const fieldCount = hasData ? countFields(data) : 0;

  return (
    <div className="mb-1">
      {/* Section Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm',
          'hover:bg-accent transition-colors',
          hasData ? 'font-medium' : 'text-muted-foreground'
        )}
      >
        {/* Expand/Collapse Icon */}
        {hasData ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )
        ) : (
          <Circle className="h-4 w-4 opacity-30" />
        )}

        {/* Status Icon */}
        {hasData ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Circle className="h-4 w-4" />
        )}

        {/* Section Label */}
        <span className="mr-1">{section.icon}</span>
        <span className="flex-1 text-left">{section.label}</span>

        {/* Field Count */}
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
          </span>
        )}
      </button>

      {/* Section Content */}
      {isOpen && hasData && (
        <div className="ml-6 mt-1 space-y-1">
          <DataTree data={data} level={0} />
        </div>
      )}
    </div>
  );
}

interface DataTreeProps {
  data: any;
  level: number;
}

function DataTree({ data, level }: DataTreeProps) {
  if (!data || typeof data !== 'object') {
    return null;
  }

  return (
    <>
      {Object.entries(data).map(([key, value]) => (
        <DataField key={key} fieldKey={key} value={value} level={level} />
      ))}
    </>
  );
}

interface DataFieldProps {
  fieldKey: string;
  value: any;
  level: number;
}

function DataField({ fieldKey, value, level }: DataFieldProps) {
  const [isOpen, setIsOpen] = useState(level < 2); // Auto-expand first 2 levels

  // Format key for display (camelCase -> Title Case)
  const displayKey = fieldKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();

  // Handle different value types
  if (value === null || value === undefined || value === '') {
    return null; // Don't show empty fields
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    return (
      <div className="text-xs" style={{ marginLeft: `${level * 12}px` }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 hover:text-foreground text-muted-foreground py-0.5"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">{displayKey}</span>
          <span className="text-muted-foreground ml-1">
            ({value.length} {value.length === 1 ? 'item' : 'items'})
          </span>
        </button>
        {isOpen && (
          <div className="ml-4 mt-1 space-y-1">
            {value.map((item, i) => (
              <div key={i} className="text-muted-foreground">
                {typeof item === 'object' ? (
                  <DataTree data={item} level={level + 1} />
                ) : (
                  <div className="py-0.5">• {String(item)}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === 'object') {
    const subFields = Object.keys(value).length;
    if (subFields === 0) return null;

    return (
      <div className="text-xs" style={{ marginLeft: `${level * 12}px` }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 hover:text-foreground text-muted-foreground py-0.5"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="font-medium">{displayKey}</span>
          <span className="text-muted-foreground ml-1">
            ({subFields} {subFields === 1 ? 'field' : 'fields'})
          </span>
        </button>
        {isOpen && (
          <div className="ml-4 mt-1">
            <DataTree data={value} level={level + 1} />
          </div>
        )}
      </div>
    );
  }

  // Primitive value
  return (
    <div
      className="text-xs py-0.5 flex gap-2"
      style={{ marginLeft: `${level * 12}px` }}
    >
      <span className="font-medium text-muted-foreground min-w-[100px]">
        {displayKey}:
      </span>
      <span className="text-foreground flex-1 break-words">
        {String(value)}
      </span>
    </div>
  );
}

/**
 * Count total fields in a data object (including nested)
 */
function countFields(obj: any): number {
  if (!obj || typeof obj !== 'object') return 0;

  let count = 0;

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        count += value.length > 0 ? 1 : 0;
      } else {
        count += countFields(value);
      }
    } else if (value !== null && value !== undefined && value !== '') {
      count++;
    }
  }

  return count;
}
