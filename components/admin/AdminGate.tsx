'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, LogIn, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';

/**
 * Rendered by the admin layout instead of the admin UI when the request has no
 * valid session. The admin pages and the machine data they hold are never sent
 * to the browser in that case — this is the whole page, not an overlay on it.
 */
export function AdminGate() {
  const { login } = useAuth();
  const pathname = usePathname();

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <h1 className="font-heading text-xl font-semibold">Admin sign-in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Printer settings can only be viewed and changed by signed-in makerspace admins.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button size="lg" onClick={() => login(pathname)}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
          <Button variant="ghost" size="lg" render={<Link href="/" />}>
            <ArrowLeft className="h-4 w-4" />
            Back to printers
          </Button>
        </div>
      </div>
    </main>
  );
}
