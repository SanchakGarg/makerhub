import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getServerUser } from '@/lib/auth/server-session';
import { AdminGate } from '@/components/admin/AdminGate';
import { AuthButton } from '@/components/AuthButton';
import { ThemeToggle } from '@/components/ThemeToggle';

// Reads the session cookie on every request — an admin page must never be
// served from a cache that could outlive the session that produced it.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();

  if (!user) return <AdminGate />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Printers
          </Link>
          <span className="text-border">/</span>
          <span className="font-heading text-sm font-medium">Admin</span>
          <div className="ml-auto flex items-center gap-1">
            <AuthButton />
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
