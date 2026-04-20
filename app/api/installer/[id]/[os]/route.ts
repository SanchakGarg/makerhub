import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getMachines, getConfigDir, getSystemConfigDir, walkDir, Machine } from '@/lib/machines';

// ── OrcaSlicer generators ─────────────────────────────────────────────────

function generateOrcaWindows(machine: Machine, relFiles: string[], serverUrl: string, sysFiles: string[] = []) {
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

  const ps = `$orca    = "$env:APPDATA\\OrcaSlicer\\user\\default"
$orcaSys = "$env:APPDATA\\OrcaSlicer\\system"

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
Write-Host "   MakerHub  -  OrcaSlicer Config Installer"
Write-Host "   Machine: ${machine.id}"
Write-Host "  =============================================="
Write-Host ""

if (-not (Test-Path $orca)) {
  Write-Host "  ERROR: OrcaSlicer config folder not found."
  Write-Host "  Please install OrcaSlicer first."
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
Write-Host "   Done! Restart OrcaSlicer to load profiles."
Write-Host "  =============================================="
Write-Host ""
Read-Host "Press Enter to close"
`;

  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  return `@echo off\ntitle MakerHub — ${machine.id} Installer\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}\n`;
}

function generateOrcaUnix(machine: Machine, relFiles: string[], serverUrl: string, os: string, sysFiles: string[] = []) {
  const orcaDir =
    os === 'mac'
      ? '$HOME/Library/Application Support/OrcaSlicer/user/default'
      : '$HOME/.config/OrcaSlicer/user/default';

  const orcaSysDir =
    os === 'mac'
      ? '$HOME/Library/Application Support/OrcaSlicer/system'
      : '$HOME/.config/OrcaSlicer/system';

  const sysDownloads = sysFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/system-configs/${machine.id}/${encodedRel}`;
      const dest = `${orcaSysDir}/${rel}`;
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

  const userDownloads = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `${orcaDir}/${rel}`;
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
# MakerHub — OrcaSlicer Config Installer
# Machine: ${machine.id}

ORCA="${orcaDir}"

echo ""
echo "  =============================================="
echo "   MakerHub  -  OrcaSlicer Config Installer"
echo "   Machine: ${machine.id}"
echo "  =============================================="
echo ""

if [ ! -d "$ORCA" ]; then
  echo "  ERROR: OrcaSlicer not found at $ORCA"
  echo "  Please install OrcaSlicer first."
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
echo "   Done! Restart OrcaSlicer to load profiles."
echo "  =============================================="
echo ""
read -rp "Press Enter to close..."
`;
}

// ── Bambu Studio generators ───────────────────────────────────────────────

function generateBambuWindows(machine: Machine, relFiles: string[], serverUrl: string) {
  const psLines = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machine.id}/${encodedRel}`;
      const dest = `$bambu\\${rel.replace(/\//g, '\\')}`;
      return `  dl '${url}' "${dest}"`;
    })
    .join('\n');

  const ps = `# Detect Bambu Studio user folder (numeric account ID or 'default')
$bambuBase = "$env:APPDATA\\BambuStudio\\user"
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
Write-Host "   MakerHub  -  Bambu Studio Config Installer"
Write-Host "   Machine: ${machine.id}"
Write-Host "  =============================================="
Write-Host ""
Write-Host "  Installing to: $bambu"
Write-Host ""

if (-not (Test-Path $bambuBase)) {
  Write-Host "  ERROR: Bambu Studio config folder not found."
  Write-Host "  Please install Bambu Studio first."
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "  Installing configs..."
Write-Host ""

${psLines}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   Done! Restart Bambu Studio to load profiles."
Write-Host "  =============================================="
Write-Host ""
Read-Host "Press Enter to close"
`;

  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  return `@echo off\ntitle MakerHub — ${machine.id} Installer\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}\n`;
}

function generateBambuUnix(machine: Machine, relFiles: string[], serverUrl: string, os: string) {
  const bambuBase =
    os === 'mac'
      ? '$HOME/Library/Application Support/BambuStudio/user'
      : '$HOME/.config/BambuStudio/user';

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
# MakerHub — Bambu Studio Config Installer
# Machine: ${machine.id}

BAMBU_BASE="${bambuBase}"

# Prefer numeric account folder over 'default'
BAMBU=$(find "$BAMBU_BASE" -maxdepth 1 -type d -name '[0-9]*' | sort | head -1)
if [ -z "$BAMBU" ]; then BAMBU="$BAMBU_BASE/default"; fi

echo ""
echo "  =============================================="
echo "   MakerHub  -  Bambu Studio Config Installer"
echo "   Machine: ${machine.id}"
echo "  =============================================="
echo ""
echo "  Installing to: $BAMBU"
echo ""

if [ ! -d "$BAMBU_BASE" ]; then
  echo "  ERROR: Bambu Studio not found at $BAMBU_BASE"
  echo "  Please install Bambu Studio first."
  read -rp "Press Enter to exit..."
  exit 1
fi

echo "  Installing configs..."
echo ""

${downloads}

echo ""
echo "  =============================================="
echo "   Done! Restart Bambu Studio to load profiles."
echo "  =============================================="
echo ""
read -rp "Press Enter to close..."
`;
}

// ── Route handler ─────────────────────────────────────────────────────────

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; os: string }> }
) {
  const { id, os } = await params;
  const machines = getMachines();
  const machine = machines.find((m) => m.id === id);

  if (!machine) return new NextResponse('Machine not found', { status: 404 });

  const configDir = getConfigDir(machine);
  if (!fs.existsSync(configDir)) {
    return new NextResponse('Config directory not found', { status: 404 });
  }

  const relFiles = walkDir(configDir);
  const sysDir = getSystemConfigDir(machine);
  const sysFiles = machine.hasSystemConfig && fs.existsSync(sysDir) ? walkDir(sysDir) : [];

  const serverUrl =
    process.env.BASE_URL ||
    (() => {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    })();

  const isBambu = machine.slicer === 'bambustudio';
  let content: string;
  let filename: string;

  if (os === 'windows') {
    content = isBambu
      ? generateBambuWindows(machine, relFiles, serverUrl)
      : generateOrcaWindows(machine, relFiles, serverUrl, sysFiles);
    filename = `install-${id}.bat`;
  } else if (os === 'mac') {
    content = isBambu
      ? generateBambuUnix(machine, relFiles, serverUrl, 'mac')
      : generateOrcaUnix(machine, relFiles, serverUrl, 'mac', sysFiles);
    filename = `install-${id}.command`;
  } else {
    content = isBambu
      ? generateBambuUnix(machine, relFiles, serverUrl, 'linux')
      : generateOrcaUnix(machine, relFiles, serverUrl, 'linux', sysFiles);
    filename = `install-${id}.sh`;
  }

  return new NextResponse(content, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/octet-stream',
    },
  });
}
