'use client';

import { useState } from 'react';
import { Machine } from '@/lib/machines';
import { MachineCard } from './MachineCard';
import { MachineModal } from './MachineModal';

export function MachineGrid({ machines }: { machines: Machine[] }) {
  const [selected, setSelected] = useState<Machine | null>(null);

  return (
    <>
      <div className="flex flex-col gap-4">
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} onClick={() => setSelected(m)} />
        ))}
      </div>
      {selected && (
        <MachineModal machine={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
