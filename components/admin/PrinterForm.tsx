'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  FileJson,
  Loader2,
  Palette,
  Ruler,
  Share2,
  Tag,
  UploadCloud,
  X,
} from 'lucide-react';
import { SLICERS, SLICER_LABEL, type Machine, type Slicer } from '@/lib/machines';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccentPicker } from './AccentPicker';
import { PrinterPreview } from './PrinterPreview';
import { Field, Section } from './Section';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const SWATCHES = ['#EAB308', '#EF4444', '#9CA3AF', '#4B5563', '#22C55E', '#3B82F6'];

const ACCEPTED = ['.json', '.info'];

interface FormValues {
  name: string;
  brand: string;
  model: string;
  type: string;
  description: string;
  tags: string;
  nozzle: string;
  buildVolume: string;
  extruder: string;
  accent: string;
  slicer: Slicer;
  inheritSystemConfig: boolean;
  inheritsSystemConfigFrom: string;
}

function initialValues(machine?: Machine): FormValues {
  if (machine) {
    return {
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
      inheritSystemConfig: Boolean(machine.inheritsSystemConfigFrom),
      inheritsSystemConfigFrom: machine.inheritsSystemConfigFrom ?? '',
    };
  }
  return {
    name: '',
    brand: '',
    model: '',
    type: 'CoreXY',
    description: '',
    tags: '',
    nozzle: '0.4mm',
    buildVolume: '',
    extruder: 'Single',
    // A pre-picked colour beats black: most printers never get a deliberate one.
    accent: SWATCHES[Math.floor(Math.random() * SWATCHES.length)],
    slicer: 'orcaslicer',
    inheritSystemConfig: false,
    inheritsSystemConfigFrom: '',
  };
}

/**
 * Full-page create/edit form. `children` are rendered at the end of the left
 * column so the edit page can add its own sections (config files, danger zone)
 * without breaking out of the layout or losing the sticky preview.
 */
export function PrinterForm({ machine, children }: { machine?: Machine; children?: React.ReactNode }) {
  const isEdit = Boolean(machine);
  const router = useRouter();
  const { apiFetch } = useAuth();

  const [initial] = useState(() => initialValues(machine));
  const [form, setForm] = useState<FormValues>(initial);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [fileErrors, setFileErrors] = useState<{ file: string; reason: string }[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = useMemo(
    () => (Object.keys(form) as (keyof FormValues)[]).some((k) => form[k] !== initial[k]),
    [form, initial]
  );

  const previewTags = useMemo(() => {
    const explicit = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (explicit.length) return explicit;
    return [form.type, SLICER_LABEL[form.slicer]].filter(Boolean);
  }, [form.tags, form.type, form.slicer]);

  const canSubmit =
    Boolean(form.name.trim()) &&
    Boolean(form.description.trim()) &&
    (!form.inheritSystemConfig || Boolean(form.inheritsSystemConfigFrom.trim())) &&
    (isEdit ? dirty : files.length > 0) &&
    !saving;

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const picked = Array.from(list).filter((f) =>
      ACCEPTED.some((ext) => f.name.toLowerCase().endsWith(ext))
    );
    const rejected = list.length - picked.length;
    if (rejected > 0) toast.warning(`Ignored ${rejected} file(s) — only .json and .info are accepted.`);
    setFiles((prev) => [...prev.filter((p) => !picked.some((n) => n.name === p.name)), ...picked]);
    setFileErrors([]);
  };

  const removeFile = (name: string) => setFiles((prev) => prev.filter((f) => f.name !== name));

  const metadata = () => ({
    name: form.name.trim(),
    brand: form.brand.trim() || 'Unknown',
    model: form.model.trim() || form.name.trim(),
    type: form.type.trim() || 'CoreXY',
    description: form.description.trim(),
    tags: previewTags,
    nozzle: form.nozzle.trim() || '0.4mm',
    buildVolume: form.buildVolume.trim() || 'Unknown',
    extruder: form.extruder.trim() || 'Single',
    accent: form.accent,
    slicer: form.slicer,
    inheritsSystemConfigFrom: form.inheritSystemConfig ? form.inheritsSystemConfigFrom.trim() : '',
  });

  const create = async () => {
    setFileErrors([]);
    const body = new FormData();
    body.append('metadata', JSON.stringify(metadata()));
    for (const f of files) body.append('files', f);

    const res = await apiFetch('/api/admin/machines', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data?.error === 'file_validation_failed' && Array.isArray(data.detail)) {
        setFileErrors(data.detail);
        toast.error('Some config files were rejected.');
      } else {
        toast.error(
          typeof data?.detail === 'string' ? data.detail : (data?.error ?? 'Could not create printer')
        );
      }
      return;
    }

    toast.success(`Created "${data.machine.name}"`);
    router.push(`/admin/printers/${data.machine.id}`);
    router.refresh();
  };

  const save = async () => {
    const res = await apiFetch(`/api/admin/machines/${machine!.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata()),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(typeof body?.detail === 'string' ? body.detail : 'Save failed');
      return;
    }
    toast.success('Printer updated');
    router.push('/');
    router.refresh();
  };

  const submit = async () => {
    setSaving(true);
    try {
      await (isEdit ? save() : create());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <div className="space-y-5">
        {!isEdit && (
          <Section
            icon={FileJson}
            title="Config files"
            description="Machine, filament and process profiles exported from your slicer."
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".json,.info"
              className="hidden"
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                dragging
                  ? 'border-foreground bg-muted'
                  : 'border-border hover:border-muted-foreground/50 hover:bg-muted/40'
              }`}
            >
              <UploadCloud className="mb-2 h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-medium">Drop .json / .info files here</p>
              <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
            </div>

            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f) => (
                  <li
                    key={f.name}
                    className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs"
                  >
                    <FileJson className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate font-mono">{f.name}</span>
                    <span className="shrink-0 text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(f.name);
                      }}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {fileErrors.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-destructive/10 p-3">
                {fileErrors.map((e) => (
                  <li key={e.file} className="text-xs text-destructive">
                    <span className="font-mono">{e.file}</span> — {e.reason}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] leading-snug text-muted-foreground">
              At least one machine/printer profile is required. Filament and process profiles are
              optional, and more can be added after the printer exists.
            </p>
          </Section>
        )}

        <Section icon={Tag} title="Identity" description="How this printer appears on the public list.">
          <Field id="pf-name" label="Name" required hint="The nickname makers use, e.g. “Kiwi”.">
            <Input
              id="pf-name"
              className="h-9"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Kiwi"
            />
          </Field>

          <Field id="pf-desc" label="Description" required>
            <Textarea
              id="pf-desc"
              className="min-h-20"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What this printer is good at, and anything makers should know before using it."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pf-brand" label="Brand">
              <Input
                id="pf-brand"
                className="h-9"
                value={form.brand}
                onChange={(e) => set('brand', e.target.value)}
                placeholder="Bambu Lab"
              />
            </Field>
            <Field id="pf-model" label="Model">
              <Input
                id="pf-model"
                className="h-9"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="P1S"
              />
            </Field>
          </div>

          <Field
            id="pf-tags"
            label="Tags"
            hint={
              form.tags.trim()
                ? 'Comma-separated.'
                : `Left blank, these become: ${previewTags.join(', ')}`
            }
          >
            <Input
              id="pf-tags"
              className="h-9"
              value={form.tags}
              onChange={(e) => set('tags', e.target.value)}
              placeholder="CoreXY, OrcaSlicer"
            />
          </Field>
        </Section>

        <Section icon={Ruler} title="Specs" description="Shown in the printer’s detail panel.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="pf-type" label="Kinematics / type">
              <Input
                id="pf-type"
                className="h-9"
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                placeholder="CoreXY"
              />
            </Field>
            <Field id="pf-extruder" label="Extruder">
              <Input
                id="pf-extruder"
                className="h-9"
                value={form.extruder}
                onChange={(e) => set('extruder', e.target.value)}
                placeholder="Single"
              />
            </Field>
            <Field id="pf-nozzle" label="Nozzle">
              <Input
                id="pf-nozzle"
                className="h-9"
                value={form.nozzle}
                onChange={(e) => set('nozzle', e.target.value)}
                placeholder="0.4mm"
              />
            </Field>
            <Field id="pf-buildvol" label="Build volume">
              <Input
                id="pf-buildvol"
                className="h-9"
                value={form.buildVolume}
                onChange={(e) => set('buildVolume', e.target.value)}
                placeholder="300 × 300 × 300 mm"
              />
            </Field>
          </div>
        </Section>

        <Section
          icon={Palette}
          title="Appearance & slicer"
          description="The accent colour tints this printer’s card, tags and install button."
        >
          <Field label="Slicer software" hint="Decides which folders the installer writes into.">
            <Select value={form.slicer} onValueChange={(v) => set('slicer', v as Slicer)}>
              <SelectTrigger className="h-9 w-full">
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
          </Field>

          <Field label="Accent colour">
            <AccentPicker value={form.accent} onChange={(hex) => set('accent', hex)} />
          </Field>
        </Section>

        <Section
          icon={Share2}
          title="System config"
          description="Vendor-supplied filament/process bundles, shared across identical printers."
        >
          <label className="group/field flex items-start gap-2.5 text-sm">
            <Checkbox
              className="mt-0.5"
              checked={form.inheritSystemConfig}
              onCheckedChange={(checked) => {
                set('inheritSystemConfig', checked);
                if (!checked) set('inheritsSystemConfigFrom', '');
              }}
            />
            <span>
              Inherits system config from another printer
              <span className="mt-0.5 block text-[11px] font-normal leading-snug text-muted-foreground">
                Installs will pull the vendor system bundle from that printer&rsquo;s own folder instead of
                expecting one here.
              </span>
            </span>
          </label>

          {form.inheritSystemConfig && (
            <Field
              id="pf-inherit-from"
              label="Inherit from printer id"
              required
              hint="The exact id of the printer that owns the system config, e.g. “kiwi”."
            >
              <Input
                id="pf-inherit-from"
                className="h-9"
                value={form.inheritsSystemConfigFrom}
                onChange={(e) => set('inheritsSystemConfigFrom', e.target.value)}
                placeholder="kiwi"
              />
            </Field>
          )}
        </Section>

        {children}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Live preview</p>
          <PrinterPreview
            name={form.name}
            description={form.description}
            extruder={form.extruder}
            nozzle={form.nozzle}
            model={form.model || form.name}
            accent={form.accent}
            tags={previewTags}
          />
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex flex-col gap-2">
            <Button size="lg" onClick={submit} disabled={!canSubmit}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? (saving ? 'Saving…' : 'Save changes') : saving ? 'Creating…' : 'Create printer'}
            </Button>
            <Button variant="ghost" size="lg" render={<Link href="/" />}>
              Cancel
            </Button>
          </div>

          {isEdit && dirty && !saving && (
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Unsaved changes
            </p>
          )}
          {!isEdit && files.length === 0 && (
            <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
              Upload at least one config file to create the printer.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
