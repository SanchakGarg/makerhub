import { getMachines } from '@/lib/machines';
import { MachineGrid } from '@/components/MachineGrid';

export default function Home() {
  const machines = getMachines();
  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-2" style={{ fontFamily: 'var(--font-space-grotesk)' }}>MakerHub</h1>
        <p className="text-zinc-400">
          Select a printer to view its setup guide and download OrcaSlicer configs.
        </p>
      </div>
      <MachineGrid machines={machines} />
    </main>
  );
}
