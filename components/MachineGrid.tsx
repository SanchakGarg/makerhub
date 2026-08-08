'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Machine } from '@/lib/machines';
import { MachineCard } from './MachineCard';
import { MachineModal } from './MachineModal';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { Plus } from 'lucide-react';

export function MachineGrid({ machines }: { machines: Machine[] }) {
  const { isAuthenticated } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = machines.find((m) => m.id === selectedId) ?? null;

  return (
    <>
      {isAuthenticated && (
        <div className="mb-4">
          <Button variant="outline" size="sm" render={<Link href="/admin/printers/new" />}>
            <Plus className="h-4 w-4" />
            New printer
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} onClick={() => setSelectedId(m.id)} />
        ))}
      </div>

      {selected && <MachineModal machine={selected} onClose={() => setSelectedId(null)} />}
    </>
  );
}
