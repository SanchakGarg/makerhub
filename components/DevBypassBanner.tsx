'use client';

import { useAuth } from '@/components/AuthProvider';

export function DevBypassBanner() {
  const { devBypass } = useAuth();
  if (!devBypass) return null;

  return (
    <div className="bg-amber-500 text-black text-xs font-medium text-center py-1.5 px-4">
      DEV BYPASS ACTIVE — admin auth is disabled. Never run this outside local preview.
    </div>
  );
}
