'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Machine } from '@/lib/machines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

export function DeletePrinterButton({ machine }: { machine: Machine }) {
  const router = useRouter();
  const { apiFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(
        `/api/admin/machines/${machine.id}?confirm=${encodeURIComponent(machine.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(typeof body?.detail === 'string' ? body.detail : 'Delete failed');
        return;
      }
      toast.success(`Deleted "${machine.name}"`);
      setOpen(false);
      router.push('/');
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete printer
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {machine.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the printer, its guide and all of its config files. Anyone with the
              installer already downloaded keeps working — nobody can download a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              Type <span className="font-mono text-foreground">{machine.id}</span> to confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={machine.id}
              className="h-9 font-mono"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={confirmText.trim() !== machine.id || deleting}
              onClick={remove}
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
