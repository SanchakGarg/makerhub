'use client';

import { normalizeHex, withAlpha } from '@/lib/color';

/**
 * Mirrors MachineCard so the admin can see what a colour/name/tag change will
 * actually look like on the public list before saving it.
 */
export function PrinterPreview({
  name,
  description,
  extruder,
  nozzle,
  model,
  accent,
  tags,
}: {
  name: string;
  description: string;
  extruder: string;
  nozzle: string;
  model: string;
  accent: string;
  tags: string[];
}) {
  const safeAccent = normalizeHex(accent) ?? '#64748b';

  return (
    <div className="relative overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="absolute top-0 right-0 h-1 w-24" style={{ backgroundColor: safeAccent }} />
      <div
        className="absolute top-0 right-0 h-32 w-32 rounded-bl-full opacity-10"
        style={{ backgroundColor: safeAccent }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="font-heading text-lg font-semibold">{name || 'Unnamed printer'}</h3>
              {extruder && (
                <span
                  className="rounded-full border px-2 py-0.5 font-mono text-xs"
                  style={{ color: safeAccent, borderColor: withAlpha(safeAccent, '55') }}
                >
                  {extruder}
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              {description || 'No description yet.'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border px-1.5 py-0.5 text-xs"
                  style={{
                    color: safeAccent,
                    borderColor: withAlpha(safeAccent, '55'),
                    backgroundColor: withAlpha(safeAccent, '11'),
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right text-sm text-muted-foreground">
            <div className="font-mono">{nozzle}</div>
            <div className="mt-1 text-xs">{model}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
