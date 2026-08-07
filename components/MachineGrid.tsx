'use client';

import { useCallback, useState } from 'react';
import { Machine } from '@/lib/machines';
import { MachineCard } from './MachineCard';
import { MachineModal } from './MachineModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { CreatePrinterWizard } from '@/components/admin/CreatePrinterWizard';
import { Plus } from 'lucide-react';

export function MachineGrid({ machines: initial }: { machines: Machine[] }) {
  const { isAuthenticated } = useAuth();
  const [machines, setMachines] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const selected = machines.find((m) => m.id === selectedId) ?? null;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/machines', { cache: 'no-store' });
      if (res.ok) setMachines(await res.json());
    } catch {
      // keep showing the stale list rather than clearing it
    }
  }, []);

  return (
    <>
      {isAuthenticated && (
        <div className="mb-4">
          <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New printer
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} onClick={() => setSelectedId(m.id)} />
        ))}
      </div>

      {selected && (
        <MachineModal machine={selected} onClose={() => setSelectedId(null)} onChanged={refresh} />
      )}

      {isAuthenticated && (
        <CreatePrinterWizard open={createOpen} onOpenChange={setCreateOpen} onCreated={refresh} />
      )}
    </>
  );
}
