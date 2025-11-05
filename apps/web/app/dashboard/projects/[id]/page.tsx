'use client';

import * as React from 'react';
import { useProjectDetail } from '@/hooks/use-project-detail';
import { useProjectStream } from '@/hooks/use-project-stream';
import { ProjectHeader } from '@/components/projects/project-header';
import { WorkflowProgress } from '@/components/projects/workflow-progress';
import { ExecutionTimeline } from '@/components/projects/execution-timeline';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Code, FileText, Settings } from 'lucide-react';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [projectId, setProjectId] = React.useState<string | null>(null);

  React.useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const { data: project, isLoading, error } = useProjectDetail(projectId || '');
  const streamData = useProjectStream(projectId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error?.message || 'Project not found'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />

      <div className="grid gap-6 md:grid-cols-2">
        <WorkflowProgress workflow={streamData.workflow} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Real-time Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  streamData.isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                }`}
              />
              <span className="text-sm">
                {streamData.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {streamData.agents.size} agent updates received
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="w-full">
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="output" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Output
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Generated Code
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <ExecutionTimeline agents={streamData.agents} />
        </TabsContent>

        <TabsContent value="output" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated Output</CardTitle>
            </CardHeader>
            <CardContent>
              {project.outputPath ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Output Path:</span>
                    <Badge variant="outline">{project.outputPath}</Badge>
                  </div>
                  {project.deploymentUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Deployment URL:</span>
                      <a
                        href={project.deploymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {project.deploymentUrl}
                      </a>
                    </div>
                  )}
                  {project.repositoryUrl && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Repository:</span>
                      <a
                        href={project.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {project.repositoryUrl}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No output generated yet. Start the project to begin generation.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Code viewer coming soon. Generated files will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Project Type</p>
                  <p className="font-medium">{project.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Max Iterations</p>
                  <p className="font-medium">{project.maxIterations}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current Iteration</p>
                  <p className="font-medium">{project.currentIteration}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge>{project.status}</Badge>
                </div>
              </div>
              {project.tags && project.tags.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
