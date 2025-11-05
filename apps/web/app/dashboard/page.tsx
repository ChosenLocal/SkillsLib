import { prisma, setTenantContext } from '@business-automation/database';
import { requireAuth } from '@/lib/auth-utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/projects/project-card';
import { FolderKanban, Activity, CheckCircle2, Clock, Plus } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const user = await requireAuth();
  await setTenantContext(user.tenantId);

  // Fetch dashboard stats
  const [totalProjects, activeProjects, completedProjects, recentProjects] = await Promise.all([
    prisma.project.count({
      where: { tenantId: user.tenantId },
    }),
    prisma.project.count({
      where: { tenantId: user.tenantId, status: 'IN_PROGRESS' },
    }),
    prisma.project.count({
      where: { tenantId: user.tenantId, status: 'COMPLETED' },
    }),
    prisma.project.findMany({
      where: { tenantId: user.tenantId },
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        companyProfile: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            agentExecutions: true,
            workflowExecutions: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.name || user.email}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              All automation projects
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              Currently in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedProjects}</div>
            <p className="text-xs text-muted-foreground">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalProjects > 0 ? Math.round((completedProjects / totalProjects) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Project completion rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Recent Projects</h2>
            <p className="text-muted-foreground">
              Your latest automation projects
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/projects">
              View All
            </Link>
          </Button>
        </div>

        {recentProjects.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No projects yet</CardTitle>
              <CardDescription>
                Get started by creating your first automation project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/projects/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks to manage your automation projects
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="h-auto flex-col items-start p-4" asChild>
            <Link href="/dashboard/projects/new">
              <Plus className="mb-2 h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">Create Project</p>
                <p className="text-xs text-muted-foreground">
                  Start a new automation project
                </p>
              </div>
            </Link>
          </Button>

          <Button variant="outline" className="h-auto flex-col items-start p-4" asChild>
            <Link href="/dashboard/projects">
              <FolderKanban className="mb-2 h-6 w-6" />
              <div className="text-left">
                <p className="font-semibold">View Projects</p>
                <p className="text-xs text-muted-foreground">
                  Browse all your projects
                </p>
              </div>
            </Link>
          </Button>

          <Button variant="outline" className="h-auto flex-col items-start p-4" disabled>
            <Activity className="mb-2 h-6 w-6" />
            <div className="text-left">
              <p className="font-semibold">View Workflows</p>
              <p className="text-xs text-muted-foreground">
                Coming soon
              </p>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
