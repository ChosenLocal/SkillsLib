import { useState, useEffect, useCallback } from 'react';
import type { WizardFormData } from '../validations/wizard-schema';

interface DraftMetadata {
  savedAt: string;
  currentStep: number;
  tenantId?: string;
}

interface Draft {
  data: Partial<WizardFormData>;
  metadata: DraftMetadata;
}

const DRAFT_KEY_PREFIX = 'project-wizard-draft';
const DRAFT_EXPIRY_DAYS = 7;

/**
 * Hook for managing wizard draft persistence in localStorage
 */
export function useWizardDraft(tenantId?: string) {
  const draftKey = `${DRAFT_KEY_PREFIX}${tenantId ? `-${tenantId}` : ''}`;

  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  /**
   * Load draft from localStorage
   */
  const loadDraft = useCallback((): Draft | null => {
    try {
      const stored = localStorage.getItem(draftKey);
      if (!stored) return null;

      const draft: Draft = JSON.parse(stored);

      // Check if draft is expired
      const savedAt = new Date(draft.metadata.savedAt);
      const now = new Date();
      const daysSince = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince > DRAFT_EXPIRY_DAYS) {
        localStorage.removeItem(draftKey);
        return null;
      }

      return draft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }, [draftKey]);

  /**
   * Save draft to localStorage
   */
  const saveDraft = useCallback(
    (data: Partial<WizardFormData>, currentStep: number): boolean => {
      try {
        const draft: Draft = {
          data,
          metadata: {
            savedAt: new Date().toISOString(),
            currentStep,
            tenantId,
          },
        };

        localStorage.setItem(draftKey, JSON.stringify(draft));
        setLastSaved(new Date());
        return true;
      } catch (error) {
        console.error('Failed to save draft:', error);
        return false;
      }
    },
    [draftKey, tenantId]
  );

  /**
   * Delete draft from localStorage
   */
  const deleteDraft = useCallback((): void => {
    try {
      localStorage.removeItem(draftKey);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
  }, [draftKey]);

  /**
   * Check if draft exists
   */
  const hasDraft = useCallback((): boolean => {
    return loadDraft() !== null;
  }, [loadDraft]);

  /**
   * Cleanup old drafts on mount
   */
  useEffect(() => {
    const cleanupOldDrafts = () => {
      try {
        const keys = Object.keys(localStorage);
        const now = new Date();

        keys.forEach((key) => {
          if (key.startsWith(DRAFT_KEY_PREFIX)) {
            const stored = localStorage.getItem(key);
            if (!stored) return;

            try {
              const draft: Draft = JSON.parse(stored);
              const savedAt = new Date(draft.metadata.savedAt);
              const daysSince = (now.getTime() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

              if (daysSince > DRAFT_EXPIRY_DAYS) {
                localStorage.removeItem(key);
              }
            } catch {
              // Invalid draft, remove it
              localStorage.removeItem(key);
            }
          }
        });
      } catch (error) {
        console.error('Failed to cleanup old drafts:', error);
      }
    };

    cleanupOldDrafts();
    setIsLoading(false);
  }, []);

  return {
    loadDraft,
    saveDraft,
    deleteDraft,
    hasDraft,
    isLoading,
    lastSaved,
  };
}
