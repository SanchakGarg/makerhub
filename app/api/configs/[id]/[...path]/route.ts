import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getMachines, getConfigDir } from '@/lib/machines';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path: segments } = await params;
  const machines = getMachines();
  const machine = machines.find((m) => m.id === id);
  if (!machine) return new NextResponse('Machine not found', { status: 404 });

  const rel = segments.join('/');
  const safe = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = path.join(getConfigDir(machine), safe);

  if (!fs.existsSync(file)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const content = fs.readFileSync(file);
  return new NextResponse(content, {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
}
