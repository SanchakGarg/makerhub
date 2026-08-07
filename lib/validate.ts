import type { Machine } from './machines';
import { listConfigFiles, listSystemConfigFiles, readConfigFile, readSystemConfigFile, parseJsonFile } from './storage';

export type Category = 'filament' | 'process' | 'machine';
export type Level = 'exact' | 'strong' | 'weak' | 'none';
export type Via = 'compatible_printers' | 'printer_settings_id' | 'printer_model' | 'inherits' | 'name' | 'system-vendor';

export interface Signal {
  via: Via;
  level: Level;
  value: string;
}

export type Verdict =
  | { ok: true; level: 'exact' | 'strong' | 'weak'; signals: Signal[]; warnings: string[] }
  | { ok: false; kind: 'wrong-machine'; belongsTo: string | null; declared: string; via: Via; message: string }
  | { ok: false; kind: 'ambiguous'; message: string }
  | { ok: false; kind: 'invalid'; message: string };

interface MachineIdentity {
  id: string;
  printerNames: Set<string>;
  printerModels: Set<string>;
  profileNames: Set<string>; // config tree only
  systemNames: Set<string>; // system tree
  brandTokens: Set<string>;
}

export interface IdentityIndex {
  byId: Map<string, MachineIdentity>;
  ownerOfPrinterName: Map<string, string>;
  ownerOfProfileName: Map<string, string>;
}

// ── normalization ────────────────────────────────────────────────────────

/** Case/whitespace/@-spacing-insensitive form, so "V2 - CW2 @Aden" and
 *  "V2 - CW2@Aden" (both occur in the real corpus) compare equal. */
export function norm(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\.(json|info)$/i, '')
    .toLowerCase()
    .replace(/\s*@\s*/g, '@')
    .replace(/\s+/g, ' ')
    .trim();
}

function atToken(machineId: string): string {
  return '@' + machineId.toLowerCase();
}

function tokensOf(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0);
  return [];
}

function safeParseObject(buf: Buffer | null): Record<string, unknown> | null {
  if (!buf) return null;
  try {
    const parsed = parseJsonFile(buf);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ── identity index across all machines ──────────────────────────────────

export function buildIdentityIndex(machines: Machine[]): IdentityIndex {
  const byId = new Map<string, MachineIdentity>();
  const ownerOfPrinterName = new Map<string, string>();
  const ownerOfProfileName = new Map<string, string>();

  for (const m of machines) {
    const identity: MachineIdentity = {
      id: m.id,
      printerNames: new Set(),
      printerModels: new Set(),
      profileNames: new Set(),
      systemNames: new Set(),
      brandTokens: new Set(),
    };

    // Synthetic fallback so a brand-new machine with no files yet still has
    // an identity to validate its very first upload against.
    identity.printerNames.add(norm(`${m.id} - ${m.model}`));
    identity.printerModels.add(norm(m.model));
    for (const t of tokensOf(m.brand)) identity.brandTokens.add(t);
    for (const t of tokensOf(m.model)) identity.brandTokens.add(t);

    for (const rel of listConfigFiles(m)) {
      if (!rel.toLowerCase().endsWith('.json')) continue;
      const obj = safeParseObject(readConfigFile(m, rel));
      if (!obj) continue;
      const name = typeof obj.name === 'string' && obj.name ? obj.name : (rel.split('/').pop() ?? rel);
      identity.profileNames.add(norm(name));
      for (const cp of asStringArray(obj.compatible_printers)) identity.printerNames.add(norm(cp));
      if (typeof obj.printer_settings_id === 'string' && obj.printer_settings_id) {
        identity.printerNames.add(norm(obj.printer_settings_id));
      }
      if (typeof obj.printer_model === 'string' && obj.printer_model) {
        identity.printerModels.add(norm(obj.printer_model));
      }
    }

    for (const rel of listSystemConfigFiles(m)) {
      if (!rel.toLowerCase().endsWith('.json')) continue;
      const obj = safeParseObject(readSystemConfigFile(m, rel));
      if (!obj) continue;
      const name = typeof obj.name === 'string' && obj.name ? obj.name : (rel.split('/').pop() ?? rel);
      identity.systemNames.add(norm(name));
      // Deliberately NOT feeding system-tree compatible_printers into
      // ownerOfPrinterName: a vendor system bundle (e.g. EVA's) legitimately
      // covers dozens of sibling printer models, and doing so would make
      // this machine "claim" every one of them for cross-machine rejection.
    }

    byId.set(m.id, identity);
  }

  // Ownership maps are built from config-tree identity only.
  for (const identity of byId.values()) {
    for (const n of identity.printerNames) {
      if (!ownerOfPrinterName.has(n)) ownerOfPrinterName.set(n, identity.id);
    }
    for (const n of identity.profileNames) {
      if (!ownerOfProfileName.has(n)) ownerOfProfileName.set(n, identity.id);
    }
  }

  return { byId, ownerOfPrinterName, ownerOfProfileName };
}

// ── validation chain ─────────────────────────────────────────────────────

export interface ValidateOptions {
  /** Normalized names of other files in the same upload batch, so a derived
   *  profile can resolve `inherits` against a base template uploaded in the
   *  same request, independent of upload order. */
  pendingProfileNames?: Set<string>;
}

function wrongMachine(belongsTo: string | null, declared: string, via: Via): Verdict {
  return {
    ok: false,
    kind: 'wrong-machine',
    belongsTo,
    declared,
    via,
    message: belongsTo
      ? `This file declares "${declared}" (via ${via}), which belongs to printer "${belongsTo}" — not the selected printer.`
      : `This file declares "${declared}" (via ${via}), which is not a printer this server knows about.`,
  };
}

function firstOwner(values: string[], ownerMap: Map<string, string>): string | null {
  for (const v of values) {
    const owner = ownerMap.get(norm(v));
    if (owner) return owner;
  }
  return null;
}

const LEVEL_RANK: Record<Level, number> = { exact: 3, strong: 2, weak: 1, none: 0 };

function validateSystemConfig(o: Record<string, unknown>, target: Machine, identity: MachineIdentity): Verdict {
  const looksLikeSystemProfile = o.from === 'system' || typeof o.type === 'string';
  if (!looksLikeSystemProfile) {
    return {
      ok: false,
      kind: 'ambiguous',
      message: 'Does not look like a vendor system profile (missing `from: "system"` / `type`).',
    };
  }
  const validTypes = new Set(['filament', 'process', 'machine', 'machine_model']);
  if (typeof o.type === 'string' && !validTypes.has(o.type)) {
    return { ok: false, kind: 'invalid', message: `Unknown system profile type "${o.type}".` };
  }
  const candidate =
    (typeof o.printer_model === 'string' && o.printer_model) || (typeof o.name === 'string' && o.name) || '';
  const hit = tokensOf(candidate).some((t) => identity.brandTokens.has(t));
  if (hit) {
    return {
      ok: true,
      level: 'strong',
      signals: [{ via: 'system-vendor', level: 'strong', value: candidate }],
      warnings: [],
    };
  }
  return {
    ok: true,
    level: 'weak',
    signals: [],
    warnings: [
      `This profile does not obviously match ${target.brand}'s vendor bundle — system bundles legitimately include sibling printer profiles, so this is not blocked.`,
    ],
  };
}

/** Validates that a config JSON belongs to `target`. Never mutates. */
export function validateConfig(
  obj: unknown,
  filename: string,
  target: Machine,
  index: IdentityIndex,
  tree: 'user' | 'system',
  opts: ValidateOptions = {}
): Verdict {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return { ok: false, kind: 'invalid', message: 'Not a JSON object.' };
  }
  const o = obj as Record<string, unknown>;
  if (Object.keys(o).length === 0) {
    return { ok: false, kind: 'invalid', message: 'Empty profile.' };
  }

  const identity = index.byId.get(target.id);
  if (!identity) return { ok: false, kind: 'invalid', message: 'Unknown machine.' };

  if (tree === 'system') return validateSystemConfig(o, target, identity);

  const signals: Signal[] = [];
  const warnings: string[] = [];
  let reject: Verdict | null = null;

  // (a) compatible_printers — authoritative
  const cp = asStringArray(o.compatible_printers);
  if (cp.length) {
    const first = cp[0];
    if (cp.some((v) => identity.printerNames.has(norm(v)))) {
      signals.push({ via: 'compatible_printers', level: 'exact', value: first });
    } else {
      const owner = firstOwner(cp, index.ownerOfPrinterName);
      if (owner && owner !== target.id) {
        reject = wrongMachine(owner, first, 'compatible_printers');
      } else if (cp.some((v) => [...identity.printerModels].some((mo) => mo.length > 0 && norm(v).startsWith(mo)))) {
        // e.g. H2C: compatible_printers "Bambu Lab H2C 0.4 nozzle" starts with model "bambu lab h2c"
        signals.push({ via: 'compatible_printers', level: 'strong', value: first });
      } else {
        reject = wrongMachine(null, first, 'compatible_printers');
      }
    }
  }

  // (b) printer identity fields
  if (!reject && typeof o.printer_settings_id === 'string' && o.printer_settings_id) {
    const psid = o.printer_settings_id;
    if (identity.printerNames.has(norm(psid))) {
      signals.push({ via: 'printer_settings_id', level: 'exact', value: psid });
    } else {
      const owner = index.ownerOfPrinterName.get(norm(psid));
      if (owner && owner !== target.id) reject = wrongMachine(owner, psid, 'printer_settings_id');
    }
  }
  if (!reject && typeof o.printer_model === 'string' && o.printer_model) {
    if (identity.printerModels.has(norm(o.printer_model))) {
      signals.push({ via: 'printer_model', level: 'strong', value: o.printer_model });
    }
  }

  // (c) inherits — the majority case
  if (!reject && typeof o.inherits === 'string' && o.inherits) {
    const n = norm(o.inherits);
    if (identity.profileNames.has(n) || identity.systemNames.has(n) || opts.pendingProfileNames?.has(n)) {
      signals.push({ via: 'inherits', level: 'strong', value: o.inherits });
    } else {
      const owner = index.ownerOfProfileName.get(n);
      if (owner && owner !== target.id) {
        reject = wrongMachine(owner, o.inherits, 'inherits');
      } else {
        warnings.push(
          `Parent profile "${o.inherits}" was not found for this printer — it will not load until that profile also exists.`
        );
      }
    }
  }

  // (d) name / filename @-tag — weak signal, but a mismatch here still hard-rejects
  if (!reject) {
    const nameField = typeof o.name === 'string' && o.name ? o.name : filename;
    const n = norm(nameField);
    if (n.includes(atToken(target.id))) {
      signals.push({ via: 'name', level: 'weak', value: nameField });
    } else {
      for (const otherId of index.byId.keys()) {
        if (otherId === target.id) continue;
        if (n.includes(atToken(otherId))) {
          reject = wrongMachine(otherId, nameField, 'name');
          break;
        }
      }
    }
  }

  if (reject) return reject;

  const best = signals.reduce<Signal | null>(
    (acc, s) => (!acc || LEVEL_RANK[s.level] > LEVEL_RANK[acc.level] ? s : acc),
    null
  );
  if (best) {
    return { ok: true, level: best.level as 'exact' | 'strong' | 'weak', signals, warnings };
  }
  return {
    ok: false,
    kind: 'ambiguous',
    message: 'No printer binding found: no compatible_printers, no resolvable inherits, no @-tag in the name.',
  };
}

// ── filename safety (prevents shell/PowerShell injection into generated
//    installer scripts, which interpolate config file names verbatim) ────

const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9 ()+._@#&[\]=-]{0,149}$/;
const WIN_RESERVED_FILE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function safeConfigFilename(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.split(/[\\/]/).pop() ?? '';
  if (name !== raw) return { ok: false, reason: 'Path separators are not allowed in file names.' };
  if (!name) return { ok: false, reason: 'Empty file name.' };
  if (name.startsWith('.') || name.endsWith('.') || name.endsWith(' ')) {
    return { ok: false, reason: 'Name may not start or end with "." or " ".' };
  }
  if (!/\.(json|info)$/i.test(name)) return { ok: false, reason: 'Only .json and .info files are accepted.' };
  if (WIN_RESERVED_FILE.test(name)) return { ok: false, reason: 'Reserved Windows file name.' };
  if (!SAFE_NAME.test(name)) {
    return { ok: false, reason: 'Name contains characters that are unsafe in generated installer scripts.' };
  }
  return { ok: true, name };
}

// ── destination inference ────────────────────────────────────────────────

export interface SlotGuess {
  category: Category;
  isBase: boolean;
  confidence: 'high' | 'low';
}

export function inferSlot(
  obj: Record<string, unknown>,
  filename: string,
  machineUsesBase: boolean
): SlotGuess | null {
  if (typeof obj.type === 'string') {
    if (obj.type === 'filament') return { category: 'filament', isBase: false, confidence: 'high' };
    if (obj.type === 'process') return { category: 'process', isBase: false, confidence: 'high' };
    if (obj.type === 'machine' || obj.type === 'machine_model') {
      return { category: 'machine', isBase: false, confidence: 'high' };
    }
  }

  const has = (...keys: string[]) => keys.some((k) => k in obj);
  let machine = 0;
  let filament = 0;
  let process = 0;
  if (has('printer_settings_id', 'printer_model', 'printer_variant', 'nozzle_diameter', 'printable_area', 'printable_height', 'gcode_flavor')) {
    machine += 2;
  }
  if (has('filament_settings_id', 'filament_type', 'filament_flow_ratio', 'nozzle_temperature', 'hot_plate_temp')) {
    filament += 2;
  }
  filament += Object.keys(obj).filter((k) => k.startsWith('filament_')).length;
  if (has('print_settings_id', 'layer_height', 'sparse_infill_density', 'wall_loops', 'initial_layer_print_height')) {
    process += 2;
  }
  process += Object.keys(obj).filter((k) => k.startsWith('sparse_infill_') || k.startsWith('wall_')).length;

  const scores: [Category, number][] = [
    ['machine', machine],
    ['filament', filament],
    ['process', process],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topCat, topScore] = scores[0];
  const [, secondScore] = scores[1];
  if (topScore === 0) return null;

  const name = typeof obj.name === 'string' && obj.name ? obj.name : filename;
  const isTemplateNamed = /template/i.test(name);
  const hasCompatible = asStringArray(obj.compatible_printers).length > 0;
  const hasInherits = typeof obj.inherits === 'string' && obj.inherits.length > 0;

  let isBase = false;
  if (hasCompatible && !hasInherits) isBase = true;
  if (isTemplateNamed) isBase = true;
  if (hasInherits && !hasCompatible) isBase = false;
  if (topCat === 'machine') isBase = machineUsesBase;

  return { category: topCat, isBase, confidence: topScore - secondScore >= 2 ? 'high' : 'low' };
}

/** Whether this machine's existing machine/ profile sits under machine/base/
 *  (June/November/Aden convention) rather than machine/ directly (EVA). */
export function machineUsesBaseConvention(machine: Machine): boolean {
  return listConfigFiles(machine).some((rel) => rel.startsWith('machine/base/'));
}
