import { NextResponse } from 'next/server';
import { getMachineById, readConfigFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  const { id, path: segments } = await params;
  const machine = getMachineById(id);
  if (!machine) return new NextResponse('Machine not found', { status: 404 });

  let content: Buffer | null;
  try {
    content = readConfigFile(machine, segments.join('/'));
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
  if (content === null) {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(content), {
    headers: { 'Content-Type': 'application/octet-stream' },
  });
}
