const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const expanded = /^#([0-9A-Fa-f]{3})$/.test(trimmed)
    ? '#' + trimmed.slice(1).split('').map((c) => c + c).join('')
    : trimmed;
  return HEX_RE.test(expanded) ? expanded.toLowerCase() : null;
}

export function withAlpha(hex: string, alphaHex: string): string {
  const normalized = normalizeHex(hex) ?? '#000000';
  return normalized + alphaHex;
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? '#000000';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA) + 0.05;
  const lB = relativeLuminance(hexB) + 0.05;
  return lA > lB ? lA / lB : lB / lA;
}

/** Picks the higher-contrast foreground for a given background color. */
export function readableInk(bgHex: string): '#000000' | '#ffffff' {
  const black = contrastRatio(bgHex, '#000000');
  const white = contrastRatio(bgHex, '#ffffff');
  return black >= white ? '#000000' : '#ffffff';
}
