import { getMachines } from '@/lib/storage';
import { MachineGrid } from '@/components/MachineGrid';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AuthButton } from '@/components/AuthButton';

// machines/ + data/ are read from disk on every request (admin edits must be
// visible immediately, not only after a rebuild).
export const dynamic = 'force-dynamic';

export default function Home() {
  const machines = getMachines();
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-start justify-between mb-12">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
            3D Printers
          </h1>
          <p className="text-muted-foreground">
            Select a printer to view its setup guide and download slicer configs.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AuthButton />
          <ThemeToggle />
        </div>
      </div>
      <MachineGrid machines={machines} />
    </main>
  );
}
