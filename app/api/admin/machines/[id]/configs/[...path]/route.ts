import {
  getMachineById,
  listConfigFiles,
  listSystemConfigFiles,
  readConfigFile,
  readSystemConfigFile,
  deleteConfigFile,
  deleteSystemConfigFile,
  restoreConfigFile,
  restoreSystemConfigFile,
  parseJsonFile,
  safeRel,
} from '@/lib/storage';
import { norm } from '@/lib/validate';
import { guard, ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Tree = 'user' | 'system';

function parseTree(url: URL): Tree {
  return url.searchParams.get('tree') === 'system' ? 'system' : 'user';
}

// ── DELETE: remove one config file (+ its .json/.info sibling) ───────────

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id, path: segments } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  const url = new URL(req.url);
  const tree = parseTree(url);
  const force = url.searchParams.get('force') === '1';

  let rel: string;
  try {
    rel = safeRel(segments.join('/'));
  } catch {
    return fail(400, 'invalid_path');
  }

  const listFiles = tree === 'system' ? listSystemConfigFiles(machine) : listConfigFiles(machine);
  const readFile = tree === 'system' ? readSystemConfigFile : readConfigFile;
  const deleteFile = tree === 'system' ? deleteSystemConfigFile : deleteConfigFile;

  if (!listFiles.includes(rel)) return fail(404, 'file_not_found');

  if (rel.toLowerCase().endsWith('.json') && !force) {
    const buf = readFile(machine, rel);
    if (buf) {
      try {
        const obj = parseJsonFile(buf) as Record<string, unknown>;
        const name = typeof obj.name === 'string' && obj.name ? obj.name : rel.split('/').pop()!;
        const target = norm(name);
        const dependents: string[] = [];
        for (const other of listFiles) {
          if (other === rel || !other.toLowerCase().endsWith('.json')) continue;
          const otherBuf = readFile(machine, other);
          if (!otherBuf) continue;
          try {
            const otherObj = parseJsonFile(otherBuf) as Record<string, unknown>;
            if (typeof otherObj.inherits === 'string' && norm(otherObj.inherits) === target) {
              dependents.push(other.split('/').pop() ?? other);
            }
          } catch {
            // ignore unparseable sibling
          }
        }
        if (dependents.length > 0) {
          return fail(409, 'has_dependents', { dependents });
        }
      } catch {
        // unparseable target — nothing depends on it by name, proceed
      }
    }
  }

  const deleted = [rel];
  deleteFile(machine, rel);

  const pairRel = rel.toLowerCase().endsWith('.json')
    ? rel.replace(/\.json$/i, '.info')
    : rel.toLowerCase().endsWith('.info')
      ? rel.replace(/\.info$/i, '.json')
      : null;
  if (pairRel && listFiles.includes(pairRel)) {
    deleteFile(machine, pairRel);
    deleted.push(pairRel);
  }

  return ok({ deleted });
}

// ── POST: restore a tombstoned seed file ──────────────────────────────────

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const guarded = await guard(req);
  if ('response' in guarded) return guarded.response;

  const { id, path: segments } = await params;
  const machine = getMachineById(id);
  if (!machine) return fail(404, 'machine_not_found');

  const url = new URL(req.url);
  const tree = parseTree(url);

  let rel: string;
  try {
    rel = safeRel(segments.join('/'));
  } catch {
    return fail(400, 'invalid_path');
  }

  const restoreFile = tree === 'system' ? restoreSystemConfigFile : restoreConfigFile;
  restoreFile(machine, rel);

  const pairRel = rel.toLowerCase().endsWith('.json')
    ? rel.replace(/\.json$/i, '.info')
    : rel.toLowerCase().endsWith('.info')
      ? rel.replace(/\.info$/i, '.json')
      : null;
  if (pairRel) restoreFile(machine, pairRel);

  return ok({ restored: rel });
}
