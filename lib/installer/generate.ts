import type { Machine } from '@/lib/machines';
import { SLICER_TARGETS, type Os, type SlicerTarget } from './targets';

export type { Os } from './targets';

// ── fixed-dir family (OrcaSlicer, Snapmaker Orca) ──────────────────────────

function generateFixedWindows(
  machine: Machine,
  relFiles: string[],
  serverUrl: string,
  sysFiles: string[],
  target: SlicerTarget
) {
  const { userDir, systemDir } = target.paths.windows;

  const userLines = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `$orca\\${rel.replace(/\//g, '\\')}`;
      return `  dl '${url}' "${dest}"`;
    })
    .join('\n');

  const sysLines = sysFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/system-configs/${machine.id}/${encodedRel}`;
      const dest = `$orcaSys\\${rel.replace(/\//g, '\\')}`;
      return `  dl '${url}' "${dest}"`;
    })
    .join('\n');

  const ps = `$orca    = "${userDir}"
$orcaSys = "${systemDir}"

function dl($url, $dest) {
  $dir = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) { New-Item -Path $dir -ItemType Directory -Force | Out-Null }
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Host "  OK  $([System.IO.Path]::GetFileName($dest))"
  } catch {
    Write-Host "  FAIL $([System.IO.Path]::GetFileName($dest)): $_"
  }
}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   MakerHub  -  ${target.label} Config Installer"
Write-Host "   Machine: ${machine.id}"
Write-Host "  =============================================="
Write-Host ""

if (-not (Test-Path $orca)) {
  Write-Host "  ERROR: ${target.label} config folder not found."
  Write-Host "  Please install ${target.label} first."
  Read-Host "Press Enter to exit"
  exit 1
}

${sysLines.length > 0 ? `Write-Host "  Installing system configs..."
Write-Host ""

${sysLines}

Write-Host ""` : ''}
Write-Host "  Installing user configs..."
Write-Host ""

${userLines}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   Done! Restart ${target.label} to load profiles."
Write-Host "  =============================================="
Write-Host ""
Read-Host "Press Enter to close"
`;

  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  return `@echo off\ntitle MakerHub — ${machine.id} Installer\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}\n`;
}

function generateFixedUnix(
  machine: Machine,
  relFiles: string[],
  serverUrl: string,
  os: Os,
  sysFiles: string[],
  target: SlicerTarget
) {
  const paths = os === 'mac' ? target.paths.mac : target.paths.linux;
  const dir = paths.userDir;
  const sysDir = paths.systemDir!;

  const sysDownloads = sysFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/system-configs/${machine.id}/${encodedRel}`;
      const dest = `${sysDir}/${rel}`;
      const destDir = dest.substring(0, dest.lastIndexOf('/'));
      return [
        `  mkdir -p "${destDir}"`,
        `  if curl -fsSL "${url}" -o "${dest}"; then`,
        `    echo "  OK  $(basename '${dest}')"`,
        `  else`,
        `    echo "  FAIL $(basename '${dest}')"`,
        `  fi`,
      ].join('\n');
    })
    .join('\n\n');

  const userDownloads = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `${dir}/${rel}`;
      const destDir = dest.substring(0, dest.lastIndexOf('/'));
      return [
        `  mkdir -p "${destDir}"`,
        `  if curl -fsSL "${url}" -o "${dest}"; then`,
        `    echo "  OK  $(basename '${dest}')"`,
        `  else`,
        `    echo "  FAIL $(basename '${dest}')"`,
        `  fi`,
      ].join('\n');
    })
    .join('\n\n');

  return `#!/usr/bin/env bash
# MakerHub — ${target.label} Config Installer
# Machine: ${machine.id}

ORCA="${dir}"

echo ""
echo "  =============================================="
echo "   MakerHub  -  ${target.label} Config Installer"
echo "   Machine: ${machine.id}"
echo "  =============================================="
echo ""

if [ ! -d "$ORCA" ]; then
  echo "  ERROR: ${target.label} not found at $ORCA"
  echo "  Please install ${target.label} first."
  read -rp "Press Enter to exit..."
  exit 1
fi

${sysDownloads.length > 0 ? `echo "  Installing system configs..."
echo ""

${sysDownloads}

echo ""` : ''}
echo "  Installing user configs..."
echo ""

${userDownloads}

echo ""
echo "  =============================================="
echo "   Done! Restart ${target.label} to load profiles."
echo "  =============================================="
echo ""
read -rp "Press Enter to close..."
`;
}

// ── account-scan family (Bambu Studio) ──────────────────────────────────────

function generateScanWindows(machine: Machine, relFiles: string[], serverUrl: string, target: SlicerTarget) {
  const baseDir = target.paths.windows.userDir;

  const psLines = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `$bambu\\${rel.replace(/\//g, '\\')}`;
      return `  dl '${url}' "${dest}"`;
    })
    .join('\n');

  const ps = `# Detect ${target.label} user folder (numeric account ID or 'default')
$bambuBase = "${baseDir}"
$bambu = $null

# Prefer numeric account folder over 'default'
Get-ChildItem $bambuBase -Directory | Where-Object { $_.Name -match '^\\d+$' } | Select-Object -First 1 | ForEach-Object { $bambu = $_.FullName }
if (-not $bambu) { $bambu = "$bambuBase\\default" }

function dl($url, $dest) {
  $dir = Split-Path $dest -Parent
  if (-not (Test-Path $dir)) { New-Item -Path $dir -ItemType Directory -Force | Out-Null }
  try {
    Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
    Write-Host "  OK  $([System.IO.Path]::GetFileName($dest))"
  } catch {
    Write-Host "  FAIL $([System.IO.Path]::GetFileName($dest)): $_"
  }
}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   MakerHub  -  ${target.label} Config Installer"
Write-Host "   Machine: ${machine.id}"
Write-Host "  =============================================="
Write-Host ""
Write-Host "  Installing to: $bambu"
Write-Host ""

if (-not (Test-Path $bambuBase)) {
  Write-Host "  ERROR: ${target.label} config folder not found."
  Write-Host "  Please install ${target.label} first."
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "  Installing configs..."
Write-Host ""

${psLines}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   Done! Restart ${target.label} to load profiles."
Write-Host "  =============================================="
Write-Host ""
Read-Host "Press Enter to close"
`;

  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  return `@echo off\ntitle MakerHub — ${machine.id} Installer\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}\n`;
}

function generateScanUnix(machine: Machine, relFiles: string[], serverUrl: string, os: Os, target: SlicerTarget) {
  const bambuBase = os === 'mac' ? target.paths.mac.userDir : target.paths.linux.userDir;

  const downloads = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `$BAMBU/${rel}`;
      const dir = dest.substring(0, dest.lastIndexOf('/'));
      return [
        `  mkdir -p "${dir}"`,
        `  if curl -fsSL "${url}" -o "${dest}"; then`,
        `    echo "  OK  $(basename '${dest}')"`,
        `  else`,
        `    echo "  FAIL $(basename '${dest}')"`,
        `  fi`,
      ].join('\n');
    })
    .join('\n\n');

  return `#!/usr/bin/env bash
# MakerHub — ${target.label} Config Installer
# Machine: ${machine.id}

BAMBU_BASE="${bambuBase}"

# Prefer numeric account folder over 'default'
BAMBU=$(find "$BAMBU_BASE" -maxdepth 1 -type d -name '[0-9]*' | sort | head -1)
if [ -z "$BAMBU" ]; then BAMBU="$BAMBU_BASE/default"; fi

echo ""
echo "  =============================================="
echo "   MakerHub  -  ${target.label} Config Installer"
echo "   Machine: ${machine.id}"
echo "  =============================================="
echo ""
echo "  Installing to: $BAMBU"
echo ""

if [ ! -d "$BAMBU_BASE" ]; then
  echo "  ERROR: ${target.label} not found at $BAMBU_BASE"
  echo "  Please install ${target.label} first."
  read -rp "Press Enter to exit..."
  exit 1
fi

echo "  Installing configs..."
echo ""

${downloads}

echo ""
echo "  =============================================="
echo "   Done! Restart ${target.label} to load profiles."
echo "  =============================================="
echo ""
read -rp "Press Enter to close..."
`;
}

// ── dispatch ────────────────────────────────────────────────────────────────

export function generateInstaller(
  machine: Machine,
  os: Os,
  relFiles: string[],
  sysFiles: string[],
  serverUrl: string
): { content: string; filename: string } {
  const target = SLICER_TARGETS[machine.slicer] ?? SLICER_TARGETS.orcaslicer;
  const isScan = target.family === 'account-scan';

  let content: string;
  let filename: string;

  if (os === 'windows') {
    content = isScan
      ? generateScanWindows(machine, relFiles, serverUrl, target)
      : generateFixedWindows(machine, relFiles, serverUrl, sysFiles, target);
    filename = `install-${machine.id}.bat`;
  } else if (os === 'mac') {
    content = isScan
      ? generateScanUnix(machine, relFiles, serverUrl, 'mac', target)
      : generateFixedUnix(machine, relFiles, serverUrl, 'mac', sysFiles, target);
    filename = `install-${machine.id}.command`;
  } else {
    content = isScan
      ? generateScanUnix(machine, relFiles, serverUrl, 'linux', target)
      : generateFixedUnix(machine, relFiles, serverUrl, 'linux', sysFiles, target);
    filename = `install-${machine.id}.sh`;
  }

  return { content, filename };
}
