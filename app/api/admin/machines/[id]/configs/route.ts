import {
  getMachines,
  getMachineById,
  listConfigFiles,
  listSystemConfigFiles,
  readConfigFile,
  readSystemConfigFile,
  writeConfigFile,
  writeSystemConfigFile,
  configFileLayer,
  systemConfigFileLayer,
  parseJsonFile,
} from '@/lib/storage';
import {
  buildIdentityIndex,
  validateConfig,
  safeConfigFilename,
  inferSlot,
  machineUsesBaseConvention,
  norm,
  type Category,
} from '@/lib/validate';
import { guard, ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Tree = 'user' | 'system';

function parseTree(url: URL): Tree {
  return url.searchParams.get('tree') === 'system' ? 'system' : 'user';
}

function listFiles(machine: ReturnType<typeof getMachineById>, tree: Tree) {
  if (!machine) return [];
  return tree === 'system' ? listSystemConfigFiles(machine) : listConfigFiles(machine);
}

function readFile(machine: NonNullable<ReturnType<typeof getMachineById>>, tree: Tree, rel: string) {
  return tree === 'system' ? readSystemConfigFile(machine, rel) : readConfigFile(machine, rel);
}

function writeFile(machine: NonNullable<ReturnType<typeof getMachineById>>, tree: Tree, rel: string, data: Buffer) {
  return tree === 'system' ? writeSystemConfigFile(machine, rel, data) : writeConfigFile(machine, rel, data);
}

function fileLayerOf(machine: NonNullable<ReturnType<typeof getMachineById>>, tree: Tree, rel: string) {
  return tree === 'system' ? systemConfigFileLayer(machine, rel) : configFileLayer(machine, rel);
}

// ── GET: list merged config files with binding + dependent info ──────────

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  const url = new URL(req.url);
  const tree = parseTree(url);
  const rels = listFiles(machine, tree);
  const index = buildIdentityIndex(getMachines());

  // Precompute normalized `name`/basename for every JSON file, to count dependents.
  const nameOf = new Map<string, string>(); // rel -> normalized name
  for (const rel of rels) {
    if (!rel.toLowerCase().endsWith('.json')) continue;
    const buf = readFile(machine, tree, rel);
    if (!buf) continue;
    try {
      const obj = parseJsonFile(buf) as Record<string, unknown>;
      const name = typeof obj.name === 'string' && obj.name ? obj.name : rel.split('/').pop()!;
      nameOf.set(rel, norm(name));
    } catch {
      // leave unset; treated as invalid below
    }
  }
  const inheritsOf = new Map<string, string>(); // rel -> normalized inherits target
  for (const rel of rels) {
    if (!rel.toLowerCase().endsWith('.json')) continue;
    const buf = readFile(machine, tree, rel);
    if (!buf) continue;
    try {
      const obj = parseJsonFile(buf) as Record<string, unknown>;
      if (typeof obj.inherits === 'string' && obj.inherits) inheritsOf.set(rel, norm(obj.inherits));
    } catch {
      // ignore
    }
  }
  const dependentsCount = new Map<string, number>();
  for (const [, target] of inheritsOf) {
    dependentsCount.set(target, (dependentsCount.get(target) ?? 0) + 1);
  }

  const files = rels
    .filter((rel) => rel.toLowerCase().endsWith('.json') || rel.toLowerCase().endsWith('.info'))
    .map((rel) => {
      const buf = readFile(machine, tree, rel);
      const isJson = rel.toLowerCase().endsWith('.json');
      const layer = fileLayerOf(machine, tree, rel);
      const parts = rel.split('/');
      const category = (parts[0] as Category | undefined) ?? 'other';
      const isBase = parts[1] === 'base';
      const name = rel.split('/').pop() ?? rel;
      const pairedInfo = isJson ? rels.includes(rel.replace(/\.json$/i, '.info')) : undefined;
      const pairedJson = !isJson ? rels.includes(rel.replace(/\.info$/i, '.json')) : undefined;

      let binding: { level: string; via: string | null; declared: string | null } = {
        level: 'n/a',
        via: null,
        declared: null,
      };
      if (isJson && buf) {
        try {
          const obj = parseJsonFile(buf);
          const verdict = validateConfig(obj, name, machine, index, tree === 'system' ? 'system' : 'user');
          if (verdict.ok) {
            const best = verdict.signals[verdict.signals.length - 1] ?? null;
            binding = { level: verdict.level, via: best?.via ?? null, declared: best?.value ?? null };
          } else if (verdict.kind === 'wrong-machine') {
            binding = { level: 'wrong-machine', via: verdict.via, declared: verdict.declared };
          } else {
            binding = { level: verdict.kind, via: null, declared: null };
          }
        } catch {
          binding = { level: 'invalid', via: null, declared: null };
        }
      }

      const profileName = nameOf.get(rel) ?? null;
      const dependents = profileName ? dependentsCount.get(profileName) ?? 0 : 0;

      return {
        rel,
        name,
        category,
        isBase,
        kind: isJson ? ('json' as const) : ('info' as const),
        size: buf?.length ?? 0,
        layer,
        hasInfo: pairedInfo,
        hasJson: pairedJson,
        binding,
        dependents,
      };
    })
    .sort((a, b) => a.rel.localeCompare(b.rel));

  return ok({
    machine: { id: machine.id, name: machine.name, slicer: machine.slicer, brand: machine.brand },
    machineUsesBase: machineUsesBaseConvention(machine),
    tree,
    files,
  });
}

// ── POST: validate + upload one or more files ─────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  const url = new URL(req.url);
  const tree = parseTree(url);
  if (tree === 'system' && !machine.hasSystemConfig) {
    return fail(400, 'no_system_tree', 'This machine has no system config tree.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(400, 'invalid_multipart');
  }

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (files.length === 0) return fail(400, 'no_files');

  let overridesRaw = '[]';
  let overwritesRaw = '[]';
  let placementsRaw = '{}';
  const overridesField = form.get('override');
  const overwriteField = form.get('overwrite');
  const placementsField = form.get('placements');
  if (typeof overridesField === 'string') overridesRaw = overridesField;
  if (typeof overwriteField === 'string') overwritesRaw = overwriteField;
  if (typeof placementsField === 'string') placementsRaw = placementsField;

  let overrides: string[] = [];
  let overwrites: string[] = [];
  let placements: Record<string, { category: Category; isBase: boolean }> = {};
  try {
    overrides = JSON.parse(overridesRaw);
    overwrites = JSON.parse(overwritesRaw);
    placements = JSON.parse(placementsRaw);
  } catch {
    return fail(400, 'invalid_json_field');
  }

  const MAX_FILE_BYTES = 512 * 1024;
  const existing = new Set(listFiles(machine, tree));
  const index = buildIdentityIndex(getMachines());
  const usesBase = machineUsesBaseConvention(machine);

  // Batch-aware `inherits` resolution: names of every .json file in this
  // same upload, so a derived profile can resolve against a base template
  // uploaded alongside it, independent of order.
  const pendingProfileNames = new Set<string>();
  const parsedByFilename = new Map<string, unknown>();
  for (const file of files) {
    if (!file.name.toLowerCase().endsWith('.json')) continue;
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const obj = parseJsonFile(buf);
      parsedByFilename.set(file.name, obj);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const name = (obj as Record<string, unknown>).name;
        pendingProfileNames.add(norm(typeof name === 'string' && name ? name : file.name));
      }
    } catch {
      // invalid JSON — will be reported per-file below
    }
  }

  const written: string[] = [];
  const skipped: { file: string; reason: string }[] = [];
  const errors: { file: string; reason: string }[] = [];

  for (const file of files) {
    const nameCheck = safeConfigFilename(file.name);
    if (!nameCheck.ok) {
      errors.push({ file: file.name, reason: nameCheck.reason });
      continue;
    }

    if (file.size > MAX_FILE_BYTES) {
      errors.push({ file: file.name, reason: `File exceeds ${MAX_FILE_BYTES / 1024} KB limit.` });
      continue;
    }

    const isJson = file.name.toLowerCase().endsWith('.json');
    const buf = Buffer.from(await file.arrayBuffer());

    if (isJson) {
      let obj: unknown;
      try {
        obj = parsedByFilename.has(file.name) ? parsedByFilename.get(file.name) : parseJsonFile(buf);
      } catch {
        errors.push({ file: file.name, reason: 'Invalid JSON.' });
        continue;
      }

      const verdict = validateConfig(obj, file.name, machine, index, tree, { pendingProfileNames });

      if (!verdict.ok) {
        if (verdict.kind === 'wrong-machine') {
          errors.push({ file: file.name, reason: verdict.message });
          continue;
        }
        if (verdict.kind === 'invalid') {
          errors.push({ file: file.name, reason: verdict.message });
          continue;
        }
        // ambiguous — only overridable, and only if explicitly confirmed by the client
        if (!overrides.includes(file.name)) {
          skipped.push({ file: file.name, reason: verdict.message });
          continue;
        }
      }

      const override = placements[file.name];
      const guess =
        override ?? inferSlot(obj as Record<string, unknown>, file.name, usesBase) ?? { category: 'filament' as Category, isBase: false };
      const destDir = `${guess.category}${guess.isBase ? '/base' : ''}`;
      const rel = `${destDir}/${nameCheck.name}`;

      if (existing.has(rel) && !overwrites.includes(file.name)) {
        skipped.push({ file: file.name, reason: `A file already exists at ${rel}. Confirm overwrite to replace it.` });
        continue;
      }

      writeFile(machine, tree, rel, buf);
      written.push(rel);
    } else {
      // .info sidecar — accepted only alongside (or after) its matching .json
      const jsonName = file.name.replace(/\.info$/i, '.json');
      const jsonRel = written.find((w) => w.endsWith(`/${jsonName}`) || w === jsonName);
      const jsonAlreadyThere = [...existing].some((e) => e.endsWith(`/${jsonName}`));
      if (!jsonRel && !jsonAlreadyThere) {
        errors.push({ file: file.name, reason: 'Orphan .info file: no matching .json in this upload or on the printer.' });
        continue;
      }
      const destRel = (jsonRel ?? [...existing].find((e) => e.endsWith(`/${jsonName}`))!).replace(/\.json$/i, '.info');
      if (existing.has(destRel) && !overwrites.includes(file.name)) {
        skipped.push({ file: file.name, reason: `A file already exists at ${destRel}. Confirm overwrite to replace it.` });
        continue;
      }
      writeFile(machine, tree, destRel, buf);
      written.push(destRel);
    }
  }

  return ok({ written, skipped, errors });
}
