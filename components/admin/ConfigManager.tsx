'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Machine } from '@/lib/machines';
import { Button } from '@/components/ui/button';
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
import { Trash2, Undo2, UploadCloud } from 'lucide-react';

interface FileRow {
  rel: string;
  name: string;
  category: string;
  isBase: boolean;
  kind: 'json' | 'info';
  size: number;
  layer: 'seed' | 'overlay' | null;
  hasInfo?: boolean;
  binding: { level: string; via: string | null; declared: string | null };
  dependents: number;
}

function BindingBadge({ binding }: { binding: FileRow['binding'] }) {
  const styles: Record<string, string> = {
    exact: 'text-emerald-600 border-emerald-600/40 bg-emerald-600/10',
    strong: 'text-blue-600 border-blue-600/40 bg-blue-600/10',
    weak: 'text-amber-600 border-amber-600/40 bg-amber-600/10',
    'wrong-machine': 'text-red-600 border-red-600/40 bg-red-600/10',
    ambiguous: 'text-amber-600 border-amber-600/40 bg-amber-600/10',
    invalid: 'text-red-600 border-red-600/40 bg-red-600/10',
    'n/a': 'text-muted-foreground border-border',
  };
  const label = binding.via ? `${binding.level} · ${binding.via}` : binding.level;
  return (
    <span
      title={binding.declared ?? undefined}
      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${styles[binding.level] ?? styles['n/a']}`}
    >
      {label}
    </span>
  );
}

function FileRowView({
  file,
  onDelete,
  onRestore,
}: {
  file: FileRow;
  onDelete: (file: FileRow, force: boolean) => void;
  onRestore: (file: FileRow) => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const requestDelete = async () => {
    if (file.dependents > 0) {
      setConfirmOpen(true);
      return;
    }
    onDelete(file, false);
  };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
      <span className="flex-1 truncate font-mono text-xs" title={file.rel}>
        {file.name}
        {file.isBase && <span className="ml-1.5 text-[10px] text-muted-foreground">base</span>}
      </span>
      {file.kind === 'json' && <BindingBadge binding={file.binding} />}
      <span className="text-[10px] text-muted-foreground w-16 text-right shrink-0">
        {(file.size / 1024).toFixed(1)} KB
      </span>
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
          file.layer === 'overlay' ? 'border-amber-600/40 text-amber-600' : 'border-border text-muted-foreground'
        }`}
      >
        {file.layer}
      </span>
      {file.layer === null ? (
        <Button variant="ghost" size="icon-sm" onClick={() => onRestore(file)} title="Restore">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" onClick={requestDelete} title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {file.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {file.dependents} profile{file.dependents === 1 ? '' : 's'} inherit from this template and will stop
              loading correctly in the slicer once it is removed.
              {file.layer === 'seed' && ' This file ships with MakerHub — you can restore it later.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(file, true);
                setConfirmOpen(false);
              }}
            >
              Delete anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function ConfigManager({ machine, onChanged }: { machine: Machine; onChanged?: () => void }) {
  const { apiFetch } = useAuth();
  const [tree, setTree] = useState<'user' | 'system'>('user');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingRetry, setPendingRetry] = useState<{
    files: File[];
    ambiguous: string[];
    collisions: string[];
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/machines/${machine.id}/configs?tree=${tree}`);
      if (!res.ok) {
        toast.error('Could not load config files');
        setFiles([]);
        return;
      }
      const data = await res.json();
      setFiles(data.files);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, machine.id, tree]);

  useEffect(() => {
    load();
  }, [load]);

  const doDelete = async (file: FileRow, force: boolean) => {
    const res = await apiFetch(
      `/api/admin/machines/${machine.id}/configs/${encodeURIComponent(file.rel).replace(/%2F/g, '/')}?tree=${tree}${force ? '&force=1' : ''}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      toast.success(`Deleted ${file.name}`);
      load();
      onChanged?.();
    } else {
      const body = await res.json().catch(() => ({}));
      if (body?.error === 'has_dependents') {
        toast.error(`${body.detail?.dependents?.length ?? 'Some'} profiles depend on this file.`);
      } else {
        toast.error('Delete failed');
      }
    }
  };

  const doRestore = async (file: FileRow) => {
    const res = await apiFetch(
      `/api/admin/machines/${machine.id}/configs/${encodeURIComponent(file.rel).replace(/%2F/g, '/')}?tree=${tree}`,
      { method: 'POST' }
    );
    if (res.ok) {
      toast.success(`Restored ${file.name}`);
      load();
      onChanged?.();
    } else {
      toast.error('Restore failed');
    }
  };

  const upload = async (files: File[], override: string[] = [], overwrite: string[] = []) => {
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of files) form.append('files', f);
      form.append('override', JSON.stringify(override));
      form.append('overwrite', JSON.stringify(overwrite));
      const res = await apiFetch(`/api/admin/machines/${machine.id}/configs?tree=${tree}`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.reason ?? 'Upload failed');
        return;
      }
      if (data.written.length) toast.success(`Uploaded ${data.written.length} file(s)`);
      if (data.errors.length) {
        data.errors.forEach((e: { file: string; reason: string }) => toast.error(`${e.file}: ${e.reason}`));
      }
      if (data.skipped.length) {
        const ambiguous = data.skipped
          .filter((s: { reason: string }) => !s.reason.startsWith('A file already exists'))
          .map((s: { file: string }) => s.file);
        const collisions = data.skipped
          .filter((s: { reason: string }) => s.reason.startsWith('A file already exists'))
          .map((s: { file: string }) => s.file);
        data.skipped.forEach((s: { file: string; reason: string }) => toast.warning(`${s.file}: ${s.reason}`));
        setPendingRetry({ files, ambiguous, collisions });
      } else {
        setPendingRetry(null);
      }
      if (data.written.length) {
        load();
        onChanged?.();
      }
    } finally {
      setUploading(false);
    }
  };

  const onFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    upload(Array.from(fileList));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {machine.hasSystemConfig && (
        <div className="flex gap-1 text-xs">
          <button
            onClick={() => setTree('user')}
            className={`px-2 py-1 rounded border ${tree === 'user' ? 'border-foreground' : 'border-border text-muted-foreground'}`}
          >
            User configs
          </button>
          <button
            onClick={() => setTree('system')}
            className={`px-2 py-1 rounded border ${tree === 'system' ? 'border-foreground' : 'border-border text-muted-foreground'}`}
          >
            System configs
          </button>
        </div>
      )}
      {tree === 'system' && (
        <p className="text-xs text-muted-foreground">
          System configs are the vendor&apos;s full bundle — profiles for sibling printers are expected here.
        </p>
      )}

      <div className="max-h-[26rem] overflow-y-auto border border-border rounded-md divide-y divide-border/50">
        {loading ? (
          <p className="text-sm text-muted-foreground p-3">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">No config files.</p>
        ) : (
          files
            .filter((f) => f.kind === 'json')
            .map((f) => (
              <FileRowView key={f.rel} file={f} onDelete={doDelete} onRestore={doRestore} />
            ))
        )}
      </div>

      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".json,.info"
          className="hidden"
          onChange={(e) => onFilesSelected(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full"
        >
          <UploadCloud className="h-4 w-4 mr-2" />
          {uploading ? 'Uploading…' : 'Upload .json / .info files'}
        </Button>

        {pendingRetry && (pendingRetry.ambiguous.length > 0 || pendingRetry.collisions.length > 0) && (
          <div className="mt-2 flex flex-col gap-2 text-xs">
            {pendingRetry.ambiguous.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => upload(pendingRetry.files, pendingRetry.ambiguous, pendingRetry.collisions)}
              >
                Confirm — upload {pendingRetry.ambiguous.length} unverified file(s) anyway
              </Button>
            )}
            {pendingRetry.collisions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => upload(pendingRetry.files, pendingRetry.ambiguous, pendingRetry.collisions)}
              >
                Overwrite {pendingRetry.collisions.length} existing file(s)
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
