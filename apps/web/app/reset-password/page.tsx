import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ResetPasswordPageProps {
  searchParams: {
    token?: string;
  };
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const session = await auth();

  // Redirect to dashboard if already logged in
  if (session?.user) {
    redirect('/dashboard');
  }

  const token = searchParams.token;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Set new password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>
                  Invalid or missing reset token. Please request a new password reset link.
                </AlertDescription>
              </Alert>
              <Button className="w-full" asChild>
                <Link href="/forgot-password">Request new reset link</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
