import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AlertTriangle, FolderCog } from 'lucide-react';
import { getMachineById } from '@/lib/storage';
import { getServerUser } from '@/lib/auth/server-session';
import { SLICER_LABEL } from '@/lib/machines';
import { PrinterForm } from '@/components/admin/PrinterForm';
import { ConfigManager } from '@/components/admin/ConfigManager';
import { DeletePrinterButton } from '@/components/admin/DeletePrinterButton';
import { Section } from '@/components/admin/Section';

// Machines are read from disk, so an edit made a second ago must be visible.
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Even the printer's name stays behind the login.
  if (!(await getServerUser())) return { title: 'Admin' };
  const { id } = await params;
  const machine = getMachineById(id);
  return { title: machine ? `${machine.name} · Admin` : 'Printer not found' };
}

export default async function EditPrinterPage({ params }: { params: Promise<{ id: string }> }) {
  // The layout renders the sign-in screen; this page must still opt out of
  // rendering, since segments are serialized independently of their layout.
  if (!(await getServerUser())) return null;

  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: machine.accent }}
          />
          <h1 className="font-heading text-3xl font-bold tracking-tight">{machine.name}</h1>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs">{machine.id}</span>
          <span>·</span>
          <span>{SLICER_LABEL[machine.slicer]}</span>
          <span>·</span>
          <span>{machine.hasGuide ? 'Setup guide present' : 'No setup guide'}</span>
        </p>
      </header>

      <PrinterForm machine={machine}>
        <Section
          icon={FolderCog}
          title="Config files"
          description="Profiles the installer copies into the slicer. Uploads land on top of what ships with MakerHub and can be rolled back."
        >
          <ConfigManager machine={machine} />
        </Section>

        <Section
          icon={AlertTriangle}
          title="Danger zone"
          tone="destructive"
          description="Deleting a printer removes its configs and guide for everyone."
        >
          <DeletePrinterButton machine={machine} />
        </Section>
      </PrinterForm>
    </main>
  );
}
