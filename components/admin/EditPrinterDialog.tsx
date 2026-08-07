'use client';

import { useState } from 'react';
import { Machine, SLICERS, SLICER_LABEL } from '@/lib/machines';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccentPicker } from './AccentPicker';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

export function EditPrinterDialog({
  machine,
  open,
  onOpenChange,
  onSaved,
}: {
  machine: Machine;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { apiFetch } = useAuth();
  const [form, setForm] = useState({
    name: machine.name,
    brand: machine.brand,
    model: machine.model,
    type: machine.type,
    description: machine.description,
    tags: machine.tags.join(', '),
    nozzle: machine.nozzle,
    buildVolume: machine.buildVolume,
    extruder: machine.extruder,
    accent: machine.accent,
    slicer: machine.slicer,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/admin/machines/${machine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.detail ?? 'Save failed');
        return;
      }
      toast.success('Printer updated');
      onOpenChange(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit {machine.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ep-name">Name</Label>
              <Input id="ep-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-brand">Brand</Label>
              <Input id="ep-brand" value={form.brand} onChange={(e) => set('brand', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-model">Model</Label>
              <Input id="ep-model" value={form.model} onChange={(e) => set('model', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-type">Type</Label>
              <Input id="ep-type" value={form.type} onChange={(e) => set('type', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-nozzle">Nozzle</Label>
              <Input id="ep-nozzle" value={form.nozzle} onChange={(e) => set('nozzle', e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ep-extruder">Extruder</Label>
              <Input id="ep-extruder" value={form.extruder} onChange={(e) => set('extruder', e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="ep-buildvol">Build volume</Label>
            <Input id="ep-buildvol" value={form.buildVolume} onChange={(e) => set('buildVolume', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ep-desc">Description</Label>
            <Textarea id="ep-desc" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ep-tags">Tags (comma-separated)</Label>
            <Input id="ep-tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
          </div>
          <div>
            <Label>Slicer software</Label>
            <Select value={form.slicer} onValueChange={(v) => set('slicer', v as Machine['slicer'])}>
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
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
