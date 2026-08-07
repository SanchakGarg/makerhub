import { NextResponse } from 'next/server';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { getMachineById, readGuide } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const machine = getMachineById(id);
  if (!machine) return new NextResponse('Machine not found', { status: 404 });

  const markdown = readGuide(id);
  if (markdown === null) {
    return NextResponse.json({ html: '<p>No guide available yet.</p>' });
  }
  try {
    const rawHtml = await marked.parse(markdown);
    const html = sanitizeHtml(rawHtml, {
      allowedTags: [
        'h1', 'h2', 'h3', 'p', 'ul', 'ol', 'li', 'code', 'pre', 'strong', 'em',
        'a', 'blockquote', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img',
      ],
      allowedAttributes: { a: ['href', 'title'], img: ['src', 'alt'] },
      allowedSchemes: ['http', 'https', 'mailto'],
    });
    return NextResponse.json({ html });
  } catch {
    return NextResponse.json({ error: 'Could not render guide' }, { status: 500 });
  }
}
