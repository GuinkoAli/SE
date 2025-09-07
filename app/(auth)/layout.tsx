'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/lib/context/auth-context';

/**
 * Public-only layout for auth routes (/login, /register).
 * - If a user is already authenticated, redirect them to /polls.
 * - Shows a minimal branded shell while guarding children.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/polls');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="py-4 px-6 border-b bg-white">
        <div className="container mx-auto flex justify-center">
          <h1 className="text-2xl font-bold text-slate-800">ALX Polly</h1>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>
      <footer className="py-4 px-6 border-t bg-white">
        <div className="container mx-auto text-center text-sm text-slate-500">
          &copy; {new Date().getFullYear()} ALX Polly. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
