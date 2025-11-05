import { requireAuth } from '@/lib/auth-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Brain, Sparkles, CheckCircle2, Clock, XCircle } from 'lucide-react';

export default async function AgentsPage() {
  await requireAuth();

  // Placeholder data for agent executions
  const recentExecutions = [
    {
      id: '1',
      agent: 'Business Requirements',
      layer: 'Discovery',
      status: 'completed',
      duration: '45s',
      timestamp: '5 minutes ago',
    },
    {
      id: '2',
      agent: 'Color Palette',
      layer: 'Design',
      status: 'running',
      duration: '12s',
      timestamp: '2 minutes ago',
    },
    {
      id: '3',
      agent: 'Hero Copy',
      layer: 'Content',
      status: 'completed',
      duration: '38s',
      timestamp: '10 minutes ago',
    },
    {
      id: '4',
      agent: 'Typography',
      layer: 'Design',
      status: 'failed',
      duration: '5s',
      timestamp: '15 minutes ago',
    },
  ];

  const agentLayers = [
    {
      name: 'Discovery',
      description: 'Analyze business requirements and user needs',
      agents: 8,
      icon: Brain,
    },
    {
      name: 'Design',
      description: 'Create visual design and branding',
      agents: 10,
      icon: Sparkles,
    },
    {
      name: 'Content',
      description: 'Generate marketing copy and content',
      agents: 10,
      icon: Bot,
    },
    {
      name: 'Code',
      description: 'Generate and optimize code',
      agents: 5,
      icon: Bot,
    },
    {
      name: 'Quality',
      description: 'Evaluate and improve quality',
      agents: 5,
      icon: CheckCircle2,
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
        <p className="text-muted-foreground">
          Monitor and manage AI agent executions across all layers
        </p>
      </div>

      <Tabs defaultValue="executions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="executions">Recent Executions</TabsTrigger>
          <TabsTrigger value="layers">Agent Layers</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Agent Executions</CardTitle>
              <CardDescription>
                Latest activity from all AI agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentExecutions.map((execution) => (
                  <div
                    key={execution.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        {getStatusIcon(execution.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{execution.agent}</p>
                          <Badge variant="outline" className="text-xs">
                            {execution.layer}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{execution.timestamp}</span>
                          <span>•</span>
                          <span>{execution.duration}</span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(execution.status)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="layers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agentLayers.map((layer) => (
              <Card key={layer.name} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <layer.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{layer.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {layer.agents} agents
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {layer.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
