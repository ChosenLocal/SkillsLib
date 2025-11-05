import { requireAuth } from '@/lib/auth-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Workflow, PlayCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';

export default async function WorkflowsPage() {
  await requireAuth();

  // Placeholder data
  const workflows = [
    {
      id: '1',
      name: 'Website Generation',
      description: 'Complete website generation workflow with AI agents',
      status: 'active',
      lastRun: '2 hours ago',
      executions: 12,
    },
    {
      id: '2',
      name: 'Content Generation',
      description: 'Generate blog posts and marketing content',
      status: 'idle',
      lastRun: '1 day ago',
      executions: 8,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Manage and execute AI-powered automation workflows
          </p>
        </div>
        <Button>
          <PlayCircle className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No workflows yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first automation workflow
            </p>
            <Button>
              <PlayCircle className="mr-2 h-4 w-4" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Workflow className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{workflow.name}</CardTitle>
                    </div>
                  </div>
                  <Badge
                    variant={workflow.status === 'active' ? 'default' : 'secondary'}
                  >
                    {workflow.status}
                  </Badge>
                </div>
                <CardDescription className="mt-2">
                  {workflow.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="mr-1.5 h-4 w-4" />
                      Last run
                    </div>
                    <span>{workflow.lastRun}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-muted-foreground">
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Executions
                    </div>
                    <span>{workflow.executions}</span>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    View Details
                  </Button>
                  <Button size="sm" className="flex-1">
                    <PlayCircle className="mr-1.5 h-4 w-4" />
                    Run
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
