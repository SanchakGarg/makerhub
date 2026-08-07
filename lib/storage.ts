import fs from 'fs';
import path from 'path';
import { SLICER_FOLDER, type Machine, type Layer } from './machines';

export type { Machine, Layer };

export const SEED_DIR = path.join(process.cwd(), 'machines');
export const DATA_DIR = process.env.MAKERHUB_DATA_DIR || path.join(process.cwd(), 'data');
export const OVERLAY_DIR = path.join(DATA_DIR, 'machines');
const REGISTRY_PATH = path.join(DATA_DIR, 'registry.json');
const TOMBSTONES_PATH = path.join(DATA_DIR, 'tombstones.json');

export function stripBom(s: string): string {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

export function parseJsonFile(buf: Buffer): unknown {
  return JSON.parse(stripBom(buf.toString('utf8')));
}

// ── path safety ──────────────────────────────────────────────────────────

/** Normalizes a relative path and rejects traversal/absolute/NUL. Throws on violation. */
export function safeRel(...segments: string[]): string {
  const joined = segments.join('/').replace(/\\/g, '/');
  if (joined.includes('\0')) throw new Error('invalid path: NUL byte');
  const norm = path.posix.normalize(joined);
  if (norm === '.' || norm === '') throw new Error('invalid path: empty');
  if (norm.startsWith('..') || path.posix.isAbsolute(norm)) throw new Error('invalid path: escapes root');
  return norm;
}

function resolveIn(root: string, rel: string): string {
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('path escapes root');
  return abs;
}

// ── registry (machine metadata patch) + tombstones ───────────────────────

interface Registry {
  version: 1;
  patches: Record<string, Partial<Machine>>;
  created: Machine[];
  deleted: string[];
  order: string[];
}
const EMPTY_REGISTRY: Registry = { version: 1, patches: {}, created: [], deleted: [], order: [] };

interface Tombstones {
  version: 1;
  files: string[];
}
const EMPTY_TOMBSTONES: Tombstones = { version: 1, files: [] };

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(OVERLAY_DIR, { recursive: true });
}

function readJsonSafe<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(stripBom(fs.readFileSync(p, 'utf8'))) as T;
  } catch {
    return fallback;
  }
}

function readRegistry(): Registry {
  return readJsonSafe(REGISTRY_PATH, EMPTY_REGISTRY);
}
function readTombstones(): Tombstones {
  return readJsonSafe(TOMBSTONES_PATH, EMPTY_TOMBSTONES);
}

function atomicWriteFile(p: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, p);
}

// Single-process write serialization. Sufficient for the one-container
// compose deployment this app runs under; does not protect against
// multiple replicas sharing the same data dir.
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => T): Promise<T> {
  const result = writeQueue.then(fn);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function writeRegistry(reg: Registry): void {
  ensureDataDir();
  atomicWriteFile(REGISTRY_PATH, JSON.stringify(reg, null, 2));
}
function writeTombstones(t: Tombstones): void {
  ensureDataDir();
  atomicWriteFile(TOMBSTONES_PATH, JSON.stringify(t, null, 2));
}

// ── generic merged file ops ───────────────────────────────────────────────

function isTombstoned(rel: string): boolean {
  return readTombstones().files.includes(rel);
}

export function existsMerged(rel: string): boolean {
  const safe = safeRel(rel);
  if (isTombstoned(safe)) return false;
  return fs.existsSync(path.join(OVERLAY_DIR, safe)) || fs.existsSync(path.join(SEED_DIR, safe));
}

function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

export function dirExistsMerged(rel: string): boolean {
  const safe = safeRel(rel);
  if (!isDir(path.join(OVERLAY_DIR, safe)) && !isDir(path.join(SEED_DIR, safe))) return false;
  return listMerged(safe).length > 0;
}

function walkAbs(dir: string): string[] {
  const out: string[] = [];
  function rec(d: string, base: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) rec(full, base);
      else out.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  rec(dir, dir);
  return out;
}

/** Merged relative file listing under relDir, seed ∪ overlay, tombstones removed, sorted. */
export function listMerged(relDir: string): string[] {
  const safe = safeRel(relDir);
  const seedFiles = walkAbs(path.join(SEED_DIR, safe)).map((f) => `${safe}/${f}`);
  const overlayFiles = walkAbs(path.join(OVERLAY_DIR, safe)).map((f) => `${safe}/${f}`);
  const tomb = new Set(readTombstones().files);
  const merged = new Set([...seedFiles, ...overlayFiles].filter((f) => !tomb.has(f)));
  return [...merged].map((f) => f.slice(safe.length + 1)).sort();
}

function resolveReadAbs(safe: string): string | null {
  if (isTombstoned(safe)) return null;
  const o = path.join(OVERLAY_DIR, safe);
  if (fs.existsSync(o) && fs.statSync(o).isFile()) return o;
  const s = path.join(SEED_DIR, safe);
  if (fs.existsSync(s) && fs.statSync(s).isFile()) return s;
  return null;
}

export function readFileBuffer(rel: string): Buffer | null {
  const abs = resolveReadAbs(safeRel(rel));
  return abs ? fs.readFileSync(abs) : null;
}

export function readFileText(rel: string): string | null {
  const buf = readFileBuffer(rel);
  return buf ? stripBom(buf.toString('utf8')) : null;
}

/** Always writes to the overlay. Atomic (tmp + rename). A write is an implicit un-delete. */
export function writeOverlayFile(rel: string, data: Buffer | string): void {
  const safe = safeRel(rel);
  ensureDataDir();
  const abs = resolveIn(OVERLAY_DIR, safe);
  atomicWriteFile(abs, data);
  const t = readTombstones();
  if (t.files.includes(safe)) {
    writeTombstones({ ...t, files: t.files.filter((f) => f !== safe) });
  }
}

/** Deletes the overlay copy (if any) and tombstones the seed copy (if any). */
export function deleteMerged(rel: string): void {
  const safe = safeRel(rel);
  const overlayAbs = resolveIn(OVERLAY_DIR, safe);
  let removed = false;
  if (fs.existsSync(overlayAbs)) {
    fs.unlinkSync(overlayAbs);
    removed = true;
  }
  const seedAbs = resolveIn(SEED_DIR, safe);
  if (fs.existsSync(seedAbs)) {
    const t = readTombstones();
    if (!t.files.includes(safe)) writeTombstones({ ...t, files: [...t.files, safe] });
    removed = true;
  }
  if (!removed) throw new Error('file not found');
}

export function restoreFile(rel: string): void {
  const safe = safeRel(rel);
  const t = readTombstones();
  if (t.files.includes(safe)) writeTombstones({ ...t, files: t.files.filter((f) => f !== safe) });
}

export function fileLayer(rel: string): Layer | null {
  const safe = safeRel(rel);
  if (isTombstoned(safe)) return null;
  if (fs.existsSync(resolveIn(OVERLAY_DIR, safe))) return 'overlay';
  if (fs.existsSync(resolveIn(SEED_DIR, safe))) return 'seed';
  return null;
}

// ── machine registry ─────────────────────────────────────────────────────

function withDerivedFlags(m: Machine): Machine {
  const slicerFolder = SLICER_FOLDER[m.slicer] ?? 'orcaslicer';
  return {
    ...m,
    hasGuide: existsMerged(`${m.id}/guide.md`),
    hasConfig: dirExistsMerged(`${m.id}/${slicerFolder}`),
    hasSystemConfig: dirExistsMerged(`${m.id}/orcaslicer-system`),
  };
}

export function getMachines(): Machine[] {
  const seed: Machine[] = readJsonSafe(path.join(SEED_DIR, 'machines.json'), [] as Machine[]);
  const reg = readRegistry();
  const deleted = new Set(reg.deleted);
  let list: Machine[] = seed.filter((m) => !deleted.has(m.id)).map((m) => ({ ...m, ...reg.patches[m.id] }));
  list = list.concat(reg.created);

  if (reg.order.length) {
    const orderIndex = new Map(reg.order.map((id, i) => [id, i]));
    list = [...list].sort((a, b) => {
      const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  return list.map(withDerivedFlags);
}

export function getMachineById(id: string): Machine | null {
  return getMachines().find((m) => m.id === id) ?? null;
}

export function machineLayerDir(m: Machine, layer: 'user' | 'system'): string {
  if (layer === 'system') return `${m.id}/orcaslicer-system`;
  return `${m.id}/${SLICER_FOLDER[m.slicer] ?? 'orcaslicer'}`;
}

export function listConfigFiles(m: Machine): string[] {
  return listMerged(machineLayerDir(m, 'user'));
}

export function listSystemConfigFiles(m: Machine): string[] {
  if (!m.hasSystemConfig) return [];
  return listMerged(machineLayerDir(m, 'system'));
}

export function readConfigFile(m: Machine, rel: string): Buffer | null {
  return readFileBuffer(`${machineLayerDir(m, 'user')}/${safeRel(rel)}`);
}

export function readSystemConfigFile(m: Machine, rel: string): Buffer | null {
  return readFileBuffer(`${machineLayerDir(m, 'system')}/${safeRel(rel)}`);
}

export function writeConfigFile(m: Machine, rel: string, data: Buffer | string): void {
  writeOverlayFile(`${machineLayerDir(m, 'user')}/${safeRel(rel)}`, data);
}

export function writeSystemConfigFile(m: Machine, rel: string, data: Buffer | string): void {
  writeOverlayFile(`${machineLayerDir(m, 'system')}/${safeRel(rel)}`, data);
}

export function deleteConfigFile(m: Machine, rel: string): void {
  deleteMerged(`${machineLayerDir(m, 'user')}/${safeRel(rel)}`);
}

export function deleteSystemConfigFile(m: Machine, rel: string): void {
  deleteMerged(`${machineLayerDir(m, 'system')}/${safeRel(rel)}`);
}

export function restoreConfigFile(m: Machine, rel: string): void {
  restoreFile(`${machineLayerDir(m, 'user')}/${safeRel(rel)}`);
}

export function restoreSystemConfigFile(m: Machine, rel: string): void {
  restoreFile(`${machineLayerDir(m, 'system')}/${safeRel(rel)}`);
}

export function configFileLayer(m: Machine, rel: string): Layer | null {
  return fileLayer(`${machineLayerDir(m, 'user')}/${safeRel(rel)}`);
}

export function systemConfigFileLayer(m: Machine, rel: string): Layer | null {
  return fileLayer(`${machineLayerDir(m, 'system')}/${safeRel(rel)}`);
}

export function readGuide(id: string): string | null {
  return readFileText(`${id}/guide.md`);
}

export function writeGuide(id: string, markdown: string): void {
  writeOverlayFile(`${id}/guide.md`, markdown);
}

// ── machine id validation ────────────────────────────────────────────────

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const RESERVED_IDS = new Set(['base', 'machines', 'system', 'user', 'default', 'node_modules', '.', '..']);
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function deriveMachineId(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .slice(0, 32);
  return slug || 'Printer';
}

export function validateMachineId(id: string, existing: string[]): { ok: true } | { ok: false; reason: string } {
  if (!ID_RE.test(id)) {
    return { ok: false, reason: 'Id must be 1-32 characters: letters, digits, hyphens, underscores, starting with a letter or digit.' };
  }
  if (RESERVED_IDS.has(id.toLowerCase()) || WIN_RESERVED.test(id)) {
    return { ok: false, reason: 'That id is reserved.' };
  }
  if (existing.some((e) => e.toLowerCase() === id.toLowerCase())) {
    return { ok: false, reason: 'A printer with this id already exists.' };
  }
  return { ok: true };
}

// ── machine mutations ────────────────────────────────────────────────────

export async function createMachine(input: Machine): Promise<Machine> {
  return serialize(() => {
    const existing = getMachines().map((m) => m.id);
    const check = validateMachineId(input.id, existing);
    if (!check.ok) throw new Error(check.reason);
    const reg = readRegistry();
    reg.created = [...reg.created, input];
    writeRegistry(reg);
    return withDerivedFlags(input);
  });
}

export async function patchMachine(id: string, patch: Partial<Machine>): Promise<Machine> {
  return serialize(() => {
    const reg = readRegistry();
    const createdIdx = reg.created.findIndex((m) => m.id === id);
    if (createdIdx >= 0) {
      reg.created = reg.created.map((m, i) => (i === createdIdx ? { ...m, ...patch } : m));
    } else {
      reg.patches = { ...reg.patches, [id]: { ...reg.patches[id], ...patch } };
    }
    writeRegistry(reg);
    const m = getMachineById(id);
    if (!m) throw new Error('machine not found after patch');
    return m;
  });
}

export async function deleteMachine(id: string): Promise<void> {
  return serialize(() => {
    const reg = readRegistry();
    const createdIdx = reg.created.findIndex((m) => m.id === id);
    if (createdIdx >= 0) {
      reg.created = reg.created.filter((m) => m.id !== id);
    } else if (!reg.deleted.includes(id)) {
      reg.deleted = [...reg.deleted, id];
    }
    writeRegistry(reg);
  });
}
