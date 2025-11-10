/**
 * Discovery Session Page
 *
 * Dynamic route for individual discovery chat sessions.
 * Two-column layout: chat interface + schema preview.
 */

'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Save, Trash2, ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc/react';
import { ChatInterface } from '@/components/discovery/chat-interface';
import { SchemaPreview } from '@/components/discovery/schema-preview';
import { CompletenessMeter } from '@/components/discovery/completeness-meter';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function DiscoverySessionPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { sessionId } = resolvedParams;
  const router = useRouter();
  const { toast } = useToast();
  const [showSidebar, setShowSidebar] = useState(true);

  // Fetch session data
  const { data: session, isLoading: sessionLoading } = trpc.discovery.getSession.useQuery(
    { sessionId },
    {
      refetchInterval: false, // Don't auto-refetch
      retry: false,
    }
  );

  // Send message mutation
  const sendMessageMutation = trpc.discovery.sendMessage.useMutation({
    onSuccess: (data) => {
      // Optimistically update the UI - refetch session to get updated data
      trpc.discovery.getSession.useQuery.setData({ sessionId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          messages: [
            ...old.messages,
            data.message,
          ],
          extractedData: data.extractedData,
          completeness: data.completeness,
          updatedAt: data.updatedAt,
        };
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Export schema mutation
  const exportSchemaMutation = trpc.discovery.exportSchema.useQuery(
    { sessionId, format: 'json' },
    {
      enabled: false, // Don't auto-fetch
    }
  );

  const handleSendMessage = (message: string) => {
    sendMessageMutation.mutate({
      sessionId,
      message,
    });
  };

  const handleExport = async () => {
    try {
      const result = await exportSchemaMutation.refetch();
      if (!result.data) return;

      // Create blob and download
      const blob = new Blob([result.data.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `Downloaded ${result.data.filename}`,
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export schema data',
        variant: 'destructive',
      });
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Session not found</h2>
          <p className="text-muted-foreground mb-4">
            This discovery session doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild>
            <Link href="/dashboard/discovery">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Discovery
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/discovery">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Discovery Session</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(session.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CompletenessMeter
              completeness={session.completeness}
              size="sm"
              showLabel={false}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={session.completeness === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={session.completeness === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className={showSidebar ? 'flex-1' : 'w-full'}>
          <ChatInterface
            messages={session.messages as any}
            onSendMessage={handleSendMessage}
            isLoading={sendMessageMutation.isPending}
            disabled={session.status !== 'ACTIVE'}
          />
        </div>

        {/* Schema Preview Sidebar */}
        {showSidebar && (
          <aside className="w-[400px] border-l bg-muted/30">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Progress</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSidebar(false)}
                >
                  Hide
                </Button>
              </div>
              <div className="mb-6">
                <CompletenessMeter
                  completeness={session.completeness}
                  size="md"
                  showLabel={true}
                />
              </div>
              <SchemaPreview
                data={session.extractedData}
                completeness={session.completeness}
              />
            </div>
          </aside>
        )}

        {/* Show Sidebar Button (when hidden) */}
        {!showSidebar && (
          <Button
            variant="outline"
            size="sm"
            className="absolute top-20 right-4"
            onClick={() => setShowSidebar(true)}
          >
            Show Progress
          </Button>
        )}
      </div>
    </div>
  );
}
