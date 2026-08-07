'use client';

import { normalizeHex, readableInk } from '@/lib/color';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SWATCHES = ['#EAB308', '#EF4444', '#9CA3AF', '#4B5563', '#FFFFFF', '#22C55E', '#3B82F6', '#A855F7', '#EC4899', '#F97316', '#14B8A6', '#64748B'];

export function AccentPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const normalized = normalizeHex(value) ?? '#000000';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            title={swatch}
            onClick={() => onChange(swatch)}
            className={`w-6 h-6 rounded-full border-2 ${
              normalized.toLowerCase() === swatch.toLowerCase() ? 'border-foreground' : 'border-transparent'
            }`}
            style={{ backgroundColor: swatch }}
          />
        ))}
        <input
          type="color"
          value={normalized}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded-full border-2 border-border cursor-pointer bg-transparent p-0"
          title="Custom color"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor="accent-hex" className="text-xs shrink-0">
          Hex
        </Label>
        <Input
          id="accent-hex"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#EAB308"
          className="h-8 text-xs font-mono"
        />
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Preview:</span>
        <span
          className="px-2 py-1 rounded font-semibold"
          style={{ backgroundColor: normalized, color: readableInk(normalized) }}
        >
          Button
        </span>
        <span
          className="px-2 py-0.5 rounded-full border"
          style={{ color: normalized, borderColor: normalized + '55', backgroundColor: normalized + '11' }}
        >
          Tag
        </span>
      </div>
    </div>
  );
}
