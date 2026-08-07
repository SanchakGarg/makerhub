import { NextResponse } from 'next/server';
import { getMachines } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    return NextResponse.json(getMachines());
  } catch {
    return NextResponse.json({ error: 'Could not load machines' }, { status: 500 });
  }
}
