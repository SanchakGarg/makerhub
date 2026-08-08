'use client';

import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';

export function AuthButton() {
  const { user, isAuthenticated, isLoading, devBypass, login, logout } = useAuth();

  if (isLoading) return <div className="w-9 h-9" />;

  if (!isAuthenticated) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => login()}
        aria-label="Admin sign in"
        title="Admin sign in"
        className="text-muted-foreground hover:text-foreground"
      >
        <LogIn className="h-4 w-4" />
      </Button>
    );
  }

  if (devBypass) {
    return (
      <span
        className="flex items-center justify-center w-9 h-9 text-amber-500"
        title="DEV BYPASS — auth is disabled, do not use in production"
        aria-label="DEV BYPASS — auth is disabled"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span
        className="flex items-center justify-center w-9 h-9 text-muted-foreground"
        title={user?.email ?? user?.name ?? 'Signed in as admin'}
        aria-label="Signed in as admin"
      >
        <ShieldCheck className="h-4 w-4" />
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => logout()}
        aria-label="Sign out"
        title="Sign out"
        className="text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
