'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/lib/trpc/client';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const verifyEmailMutation = trpc.auth.verifyEmail.useMutation();

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setError('Invalid or missing verification token.');
        setIsVerifying(false);
        return;
      }

      try {
        await verifyEmailMutation.mutateAsync({ token });
        setSuccess(true);

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } catch (err: any) {
        setError(err.message || 'Verification failed. The link may be expired or invalid.');
      } finally {
        setIsVerifying(false);
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>
            {isVerifying
              ? 'Verifying your email address...'
              : success
              ? 'Your email has been verified!'
              : 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVerifying && (
            <div className="flex justify-center py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900" />
            </div>
          )}

          {success && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Your email has been verified successfully! You can now sign in to your account.
                  Redirecting to sign in...
                </AlertDescription>
              </Alert>
              <Button className="w-full" asChild>
                <Link href="/">Go to Sign In</Link>
              </Button>
            </div>
          )}

          {error && !isVerifying && (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button className="w-full" asChild>
                  <Link href="/register">Create New Account</Link>
                </Button>
                <Button className="w-full" variant="outline" asChild>
                  <Link href="/">Back to Sign In</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
