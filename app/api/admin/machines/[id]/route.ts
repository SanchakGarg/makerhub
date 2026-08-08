import { revalidatePath } from 'next/cache';
import { SLICERS, type Slicer, type Machine } from '@/lib/machines';
import { getMachines, getMachineById, patchMachine, deleteMachine } from '@/lib/storage';
import { normalizeHex } from '@/lib/color';
import { guard, ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

const EDITABLE_FIELDS = [
  'name',
  'brand',
  'model',
  'type',
  'description',
  'tags',
  'nozzle',
  'buildVolume',
  'extruder',
  'accent',
  'slicer',
  'inheritsSystemConfigFrom',
] as const;

function validatePatch(body: unknown): { ok: true; patch: Partial<Machine> } | { ok: false; reason: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, reason: 'Body must be an object.' };
  }
  const b = body as Record<string, unknown>;
  const patch: Partial<Machine> = {};

  for (const key of Object.keys(b)) {
    if (!(EDITABLE_FIELDS as readonly string[]).includes(key)) {
      return { ok: false, reason: `Field "${key}" is not editable.` };
    }
  }

  if ('accent' in b) {
    if (typeof b.accent !== 'string') return { ok: false, reason: 'accent must be a string.' };
    const normalized = normalizeHex(b.accent);
    if (!normalized) return { ok: false, reason: 'accent must be a hex color like #EAB308.' };
    patch.accent = normalized;
  }
  if ('slicer' in b) {
    if (typeof b.slicer !== 'string' || !(SLICERS as readonly string[]).includes(b.slicer)) {
      return { ok: false, reason: `slicer must be one of: ${SLICERS.join(', ')}.` };
    }
    patch.slicer = b.slicer as Slicer;
  }
  if ('tags' in b) {
    if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === 'string')) {
      return { ok: false, reason: 'tags must be an array of strings.' };
    }
    patch.tags = b.tags as string[];
  }
  for (const key of ['name', 'brand', 'model', 'type', 'description', 'nozzle', 'buildVolume', 'extruder'] as const) {
    if (key in b) {
      if (typeof b[key] !== 'string') return { ok: false, reason: `${key} must be a string.` };
      patch[key] = b[key] as string;
    }
  }
  if ('inheritsSystemConfigFrom' in b) {
    if (typeof b.inheritsSystemConfigFrom !== 'string') {
      return { ok: false, reason: 'inheritsSystemConfigFrom must be a string.' };
    }
    patch.inheritsSystemConfigFrom = b.inheritsSystemConfigFrom.trim() || undefined;
  }

  return { ok: true, patch };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'invalid_json');
  }

  const validated = validatePatch(body);
  if (!validated.ok) return fail(400, 'invalid_patch', validated.reason);

  if (validated.patch.inheritsSystemConfigFrom) {
    const target = validated.patch.inheritsSystemConfigFrom;
    if (target === id) {
      return fail(400, 'invalid_inherit', 'A printer cannot inherit system config from itself.');
    }
    if (!getMachines().some((m) => m.id === target)) {
      return fail(400, 'invalid_inherit', `No printer with id "${target}" exists to inherit system config from.`);
    }
  }

  const updated = await patchMachine(id, validated.patch);
  revalidatePath('/');
  return ok({ machine: updated });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  const url = new URL(req.url);
  if (url.searchParams.get('confirm') !== id) {
    return fail(400, 'confirmation_required', `Pass ?confirm=${id} to delete this printer.`);
  }

  await deleteMachine(id);
  revalidatePath('/');
  return ok({});
}
