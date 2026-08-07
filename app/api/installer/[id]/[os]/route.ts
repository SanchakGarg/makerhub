import { NextResponse } from 'next/server';
import { getMachineById, listConfigFiles, listSystemConfigFiles } from '@/lib/storage';
import { generateInstaller, type Os } from '@/lib/installer/generate';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; os: string }> }
) {
  const { id, os } = await params;
  const machine = getMachineById(id);

  if (!machine) return new NextResponse('Machine not found', { status: 404 });

  const relFiles = listConfigFiles(machine);
  if (relFiles.length === 0) {
    return new NextResponse('Config directory not found', { status: 404 });
  }
  const sysFiles = listSystemConfigFiles(machine);

  const serverUrl =
    process.env.BASE_URL ||
    (() => {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    })();

  const resolvedOs: Os = os === 'windows' || os === 'mac' ? os : 'linux';
  const { content, filename } = generateInstaller(machine, resolvedOs, relFiles, sysFiles, serverUrl);

  return new NextResponse(content, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/octet-stream',
    },
  });
}
