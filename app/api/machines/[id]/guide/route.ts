import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { marked } from 'marked';
import { MACHINES_DIR } from '@/lib/machines';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = path.join(MACHINES_DIR, id, 'guide.md');
  if (!fs.existsSync(p)) {
    return NextResponse.json({ html: '<p>No guide available yet.</p>' });
  }
  try {
    const html = await marked.parse(fs.readFileSync(p, 'utf8'));
    return NextResponse.json({ html });
  } catch {
    return NextResponse.json({ error: 'Could not render guide' }, { status: 500 });
  }
}
