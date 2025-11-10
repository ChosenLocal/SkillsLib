/**
 * Discovery Home Page
 *
 * Lists all discovery sessions and provides button to start new session.
 */

'use client';

import { Plus, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function DiscoveryPage() {
  const { data: sessions, isLoading } = trpc.discovery.list.useQuery({
    limit: 20,
  });

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Discovery Sessions</h1>
          <p className="text-muted-foreground mt-2">
            Build comprehensive client profiles through AI-powered conversations
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/dashboard/discovery/new">
            <Plus className="mr-2 h-5 w-5" />
            New Session
          </Link>
        </Button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sessions && sessions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session as any} />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

interface SessionCardProps {
  session: {
    id: string;
    status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
    completeness: number;
    createdAt: Date;
    updatedAt: Date;
  };
}

function SessionCard({ session }: SessionCardProps) {
  const statusConfig = {
    ACTIVE: {
      label: 'In Progress',
      variant: 'default' as const,
      icon: MessageSquare,
      color: 'text-blue-500',
    },
    COMPLETED: {
      label: 'Completed',
      variant: 'secondary' as const,
      icon: CheckCircle2,
      color: 'text-green-500',
    },
    ABANDONED: {
      label: 'Abandoned',
      variant: 'outline' as const,
      icon: Clock,
      color: 'text-gray-500',
    },
  };

  const config = statusConfig[session.status];
  const StatusIcon = config.icon;

  return (
    <Link href={`/dashboard/discovery/${session.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <StatusIcon className={cn('h-5 w-5', config.color)} />
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
          <CardTitle className="text-lg mt-2">
            Discovery Session
          </CardTitle>
          <CardDescription>
            Started {new Date(session.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Completeness Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{session.completeness}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  session.completeness < 30 && 'bg-destructive',
                  session.completeness >= 30 && session.completeness < 70 && 'bg-yellow-500',
                  session.completeness >= 70 && 'bg-green-500'
                )}
                style={{ width: `${session.completeness}%` }}
              />
            </div>
          </div>

          {/* Last Updated */}
          <div className="mt-4 text-xs text-muted-foreground">
            Updated {new Date(session.updatedAt).toLocaleDateString()}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed rounded-lg">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No discovery sessions yet</h3>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Start your first discovery session to build a comprehensive client profile
        through an AI-powered conversation.
      </p>
      <Button asChild size="lg">
        <Link href="/dashboard/discovery/new">
          <Plus className="mr-2 h-5 w-5" />
          Start First Session
        </Link>
      </Button>
    </div>
  );
}
