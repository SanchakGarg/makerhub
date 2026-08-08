import type { Metadata } from 'next';
import { getServerUser } from '@/lib/auth/server-session';
import { PrinterForm } from '@/components/admin/PrinterForm';

export const metadata: Metadata = { title: 'New printer · Admin' };

export default async function NewPrinterPage() {
  // The layout renders the sign-in screen; this page must still opt out of
  // rendering, since segments are serialized independently of their layout.
  if (!(await getServerUser())) return null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight">New printer</h1>
        <p className="mt-1.5 text-muted-foreground">
          Upload the slicer profiles, describe the machine, and it shows up on the printer list with
          a one-click installer.
        </p>
      </header>

      <PrinterForm />
    </main>
  );
}
