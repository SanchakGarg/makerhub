'use client';

import { useRef, useState } from 'react';
import { SLICERS, SLICER_LABEL, type Slicer } from '@/lib/machines';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccentPicker } from './AccentPicker';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { UploadCloud, X } from 'lucide-react';

const SWATCHES = ['#EAB308', '#EF4444', '#9CA3AF', '#4B5563', '#22C55E', '#3B82F6'];

export function CreatePrinterWizard({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const { apiFetch } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({
    name: '',
    brand: '',
    model: '',
    type: 'CoreXY',
    description: '',
    nozzle: '0.4mm',
    buildVolume: '',
    extruder: 'Single',
    accent: SWATCHES[Math.floor(Math.random() * SWATCHES.length)],
    slicer: 'orcaslicer' as Slicer,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ file: string; reason: string }[]>([]);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const canSubmit = files.length > 0 && form.name.trim() && form.description.trim() && !saving;

  const submit = async () => {
    setErrors([]);
    setSaving(true);
    try {
      const metadata = {
        name: form.name.trim(),
        brand: form.brand.trim() || 'Unknown',
        model: form.model.trim() || form.name.trim(),
        type: form.type.trim() || 'CoreXY',
        description: form.description.trim(),
        tags: [form.type, SLICER_LABEL[form.slicer]].filter(Boolean),
        nozzle: form.nozzle.trim() || '0.4mm',
        buildVolume: form.buildVolume.trim() || 'Unknown',
        extruder: form.extruder.trim() || 'Single',
        accent: form.accent,
        slicer: form.slicer,
      };

      const body = new FormData();
      body.append('metadata', JSON.stringify(metadata));
      for (const f of files) body.append('files', f);

      const res = await apiFetch('/api/admin/machines', { method: 'POST', body });
      const data = await res.json();

      if (!res.ok) {
        if (data?.error === 'file_validation_failed') {
          setErrors(data.detail);
        } else {
          toast.error(data?.detail ?? data?.error ?? 'Could not create printer');
        }
        return;
      }

      toast.success(`Created printer "${data.machine.name}"`);
      onOpenChange(false);
      setFiles([]);
      setForm((f) => ({ ...f, name: '', brand: '', model: '', description: '', buildVolume: '' }));
      onCreated?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a new printer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
          <div>
            <Label>Printer config file(s)</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,.info"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload machine / filament / process .json files
            </Button>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                    <span className="flex-1 truncate font-mono">{f.name}</span>
                    <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {errors.map((e) => (
                  <li key={e.file} className="text-xs text-destructive">
                    {e.file}: {e.reason}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Include at least one machine/printer profile — filament and process profiles are optional.
            </p>
          </div>

          <div>
            <Label htmlFor="np-name">Name</Label>
            <Input id="np-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Kiwi" />
          </div>
          <div>
            <Label htmlFor="np-desc">Description</Label>
            <Textarea id="np-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="np-brand">Brand</Label>
              <Input id="np-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="np-model">Model</Label>
              <Input id="np-model" value={form.model} onChange={(e) => set('model', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="np-nozzle">Nozzle</Label>
              <Input id="np-nozzle" value={form.nozzle} onChange={(e) => set('nozzle', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="np-buildvol">Build volume</Label>
              <Input id="np-buildvol" value={form.buildVolume} onChange={(e) => set('buildVolume', e.target.value)} placeholder="300 × 300 × 300 mm" />
            </div>
          </div>

          <div>
            <Label>Slicer software</Label>
            <Select value={form.slicer} onValueChange={(v) => set('slicer', v as Slicer)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLICERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SLICER_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Accent color</Label>
            <AccentPicker value={form.accent} onChange={(hex) => set('accent', hex)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {saving ? 'Creating…' : 'Create printer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
