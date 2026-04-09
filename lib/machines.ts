import fs from 'fs';
import path from 'path';

export const MACHINES_DIR = path.join(process.cwd(), 'machines');

export interface Machine {
  id: string;
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
  slicer: 'orcaslicer' | 'bambustudio';
  hasGuide: boolean;
  hasConfig: boolean;
}

export function getMachines(): Machine[] {
  const data = fs.readFileSync(path.join(MACHINES_DIR, 'machines.json'), 'utf8');
  return JSON.parse(data);
}

export function getConfigDir(machine: Machine): string {
  const slicerFolder = machine.slicer === 'bambustudio' ? 'bambustudio' : 'orcaslicer';
  return path.join(MACHINES_DIR, machine.id, slicerFolder);
}

export function walkDir(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, base));
    } else {
      results.push(path.relative(base, full).replace(/\\/g, '/'));
    }
  }
  return results;
}
