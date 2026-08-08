import { revalidatePath } from 'next/cache';
import { SLICERS, type Slicer, type Machine } from '@/lib/machines';
import {
  getMachines,
  createMachine,
  deriveMachineId,
  validateMachineId,
  writeConfigFile,
  parseJsonFile,
} from '@/lib/storage';
import { normalizeHex } from '@/lib/color';
import { buildIdentityIndex, safeConfigFilename, inferSlot, norm, type Category } from '@/lib/validate';
import { guard, ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

interface NewMachineInput {
  id?: string;
  name: string;
  brand: string;
  model: string;
  type: string;
  description: string;
  tags: string[];
  nozzle: string;
  buildVolume: string;
  extruder: string;
  accent: string;
  slicer: Slicer;
  inheritsSystemConfigFrom?: string;
}

function validateInput(body: unknown): { ok: true; input: NewMachineInput } | { ok: false; reason: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'metadata must be an object.' };
  }
  const b = body as Record<string, unknown>;
  const required = ['name', 'brand', 'model', 'type', 'description', 'nozzle', 'buildVolume', 'extruder', 'accent', 'slicer'];
  for (const key of required) {
    if (typeof b[key] !== 'string' || !(b[key] as string).trim()) {
      return { ok: false, reason: `${key} is required.` };
    }
  }
  if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === 'string')) {
    return { ok: false, reason: 'tags must be an array of strings.' };
  }
  const accent = normalizeHex(b.accent as string);
  if (!accent) return { ok: false, reason: 'accent must be a hex color like #EAB308.' };
  if (!(SLICERS as readonly string[]).includes(b.slicer as string)) {
    return { ok: false, reason: `slicer must be one of: ${SLICERS.join(', ')}.` };
  }
  if (b.id !== undefined && typeof b.id !== 'string') {
    return { ok: false, reason: 'id must be a string.' };
  }
  if (b.inheritsSystemConfigFrom !== undefined && typeof b.inheritsSystemConfigFrom !== 'string') {
    return { ok: false, reason: 'inheritsSystemConfigFrom must be a string.' };
  }

  return {
    ok: true,
    input: {
      id: b.id as string | undefined,
      name: b.name as string,
      brand: b.brand as string,
      model: b.model as string,
      type: b.type as string,
      description: b.description as string,
      tags: b.tags as string[],
      nozzle: b.nozzle as string,
      buildVolume: b.buildVolume as string,
      extruder: b.extruder as string,
      accent,
      slicer: b.slicer as Slicer,
      inheritsSystemConfigFrom: (b.inheritsSystemConfigFrom as string | undefined)?.trim() || undefined,
    },
  };
}

export async function POST(req: Request) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'invalid_multipart');
  }

  const metadataRaw = form.get('metadata');
  if (typeof metadataRaw !== 'string') return fail(400, 'missing_metadata');

  let metadataJson: unknown;
  try {
    metadataJson = JSON.parse(metadataRaw);
  } catch {
    return fail(400, 'invalid_metadata_json');
  }

  const validated = validateInput(metadataJson);
  if (!validated.ok) return fail(400, 'invalid_metadata', validated.reason);
  const { input } = validated;

  const existingMachines = getMachines();
  const existingIds = existingMachines.map((m) => m.id);
  const id = input.id?.trim() || deriveMachineId(input.name);
  const idCheck = validateMachineId(id, existingIds);
  if (!idCheck.ok) return fail(400, 'invalid_id', idCheck.reason);

  if (input.inheritsSystemConfigFrom) {
    if (input.inheritsSystemConfigFrom === id) {
      return fail(400, 'invalid_inherit', 'A printer cannot inherit system config from itself.');
    }
    if (!existingIds.includes(input.inheritsSystemConfigFrom)) {
      return fail(
        400,
        'invalid_inherit',
        `No printer with id "${input.inheritsSystemConfigFrom}" exists to inherit system config from.`
      );
    }
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);

  const hasMachineFile = await (async () => {
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.json')) continue;
      try {
        const obj = parseJsonFile(Buffer.from(await file.arrayBuffer()));
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const guess = inferSlot(obj as Record<string, unknown>, file.name, true);
          if (guess?.category === 'machine') return true;
        }
      } catch {
        // ignore, reported later
      }
    }
    return false;
  })();
  if (!hasMachineFile) {
    return fail(400, 'missing_machine_profile', 'Upload at least one printer/machine config file to create a new printer.');
  }

  // Reject if any uploaded file actually belongs to an EXISTING machine —
  // this endpoint creates a new printer, it must not silently adopt another
  // printer's config tree.
  const existingIndex = buildIdentityIndex(existingMachines);
  const MAX_FILE_BYTES = 512 * 1024;
  const rejected: { file: string; reason: string }[] = [];
  const toWrite: { rel: string; buf: Buffer }[] = [];

  for (const file of files) {
    const nameCheck = safeConfigFilename(file.name);
    if (!nameCheck.ok) {
      rejected.push({ file: file.name, reason: nameCheck.reason });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ file: file.name, reason: `File exceeds ${MAX_FILE_BYTES / 1024} KB limit.` });
      continue;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (!file.name.toLowerCase().endsWith('.json')) {
      // .info sidecar: pair by stem against files in this same batch
      const jsonName = file.name.replace(/\.info$/i, '.json');
      if (!files.some((f) => f.name === jsonName)) {
        rejected.push({ file: file.name, reason: 'Orphan .info file: no matching .json in this upload.' });
      }
      continue; // paired below once the .json's destination is known
    }

    let obj: unknown;
    try {
      obj = parseJsonFile(buf);
    } catch {
      rejected.push({ file: file.name, reason: 'Invalid JSON.' });
      continue;
    }
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      rejected.push({ file: file.name, reason: 'Not a JSON object.' });
      continue;
    }
    const o = obj as Record<string, unknown>;

    const declaredNames = [
      ...(Array.isArray(o.compatible_printers) ? o.compatible_printers.filter((x) => typeof x === 'string') : []),
      ...(typeof o.printer_settings_id === 'string' ? [o.printer_settings_id] : []),
    ];
    const owner = declaredNames.map((n) => existingIndex.ownerOfPrinterName.get(norm(n))).find(Boolean);
    if (owner) {
      rejected.push({ file: file.name, reason: `This file belongs to printer "${owner}" — it cannot be used to create a new printer.` });
      continue;
    }
    const nameField = typeof o.name === 'string' && o.name ? o.name : file.name;
    const nameOwner = existingIndex.ownerOfProfileName.get(norm(nameField));
    if (nameOwner) {
      rejected.push({ file: file.name, reason: `This file belongs to printer "${nameOwner}" — it cannot be used to create a new printer.` });
      continue;
    }

    const guess = inferSlot(o, file.name, true) ?? { category: 'filament' as Category, isBase: false };
    const destDir = `${guess.category}${guess.isBase ? '/base' : ''}`;
    toWrite.push({ rel: `${destDir}/${nameCheck.name}`, buf });

    // pair its .info sidecar now that we know the destination
    const infoFile = files.find((f) => f.name === file.name.replace(/\.json$/i, '.info'));
    if (infoFile) {
      const infoBuf = Buffer.from(await infoFile.arrayBuffer());
      toWrite.push({ rel: `${destDir}/${nameCheck.name.replace(/\.json$/i, '.info')}`, buf: infoBuf });
    }
  }

  if (rejected.length > 0) {
    return fail(400, 'file_validation_failed', rejected);
  }

  const machine: Machine = {
    id,
    name: input.name,
    brand: input.brand,
    model: input.model,
    type: input.type,
    description: input.description,
    tags: input.tags,
    nozzle: input.nozzle,
    buildVolume: input.buildVolume,
    extruder: input.extruder,
    accent: input.accent,
    slicer: input.slicer,
    inheritsSystemConfigFrom: input.inheritsSystemConfigFrom,
    hasGuide: false,
    hasConfig: false,
  };

  for (const { rel, buf } of toWrite) {
    writeConfigFile(machine, rel, buf);
  }

  const created = await createMachine(machine);
  revalidatePath('/');
  return ok({ machine: created, written: toWrite.map((w) => w.rel) }, { status: 201 });
}
