/**
 * New Discovery Session Page
 *
 * Starts a new discovery session and redirects to the session page.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/react';
import { useToast } from '@/hooks/use-toast';

export default function NewDiscoverySessionPage() {
  const router = useRouter();
  const { toast } = useToast();

  const startSessionMutation = trpc.discovery.startSession.useMutation({
    onSuccess: (data) => {
      // Redirect to the new session
      router.push(`/dashboard/discovery/${data.sessionId}`);
    },
    onError: (error) => {
      toast({
        title: 'Failed to start session',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      });
      // Redirect back to discovery home
      router.push('/dashboard/discovery');
    },
  });

  useEffect(() => {
    // Start session on mount
    startSessionMutation.mutate({});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Starting new discovery session...</p>
      </div>
    </div>
  );
}
