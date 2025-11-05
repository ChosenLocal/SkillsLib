import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LoginForm } from '@/components/auth/login-form';

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full max-w-md space-y-8 px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Business Automation
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            AI-powered business automation platform
          </p>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <LoginForm />
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400">
          Sign in to access your dashboard and manage your automation workflows
        </p>
      </div>
    </div>
  );
}
