import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { MACHINES_DIR, walkDir } from '@/lib/machines';

function generateWindows(machineId: string, relFiles: string[], serverUrl: string) {
  const psLines = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machineId}/${encodedRel}`;
      const dest = `$orca\\${rel.replace(/\//g, '\\')}`;
      return `  dl '${url}' "${dest}"`;
    })
    .join('\n');

  const ps = `$orca = "$env:APPDATA\\OrcaSlicer\\user\\default"

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
Write-Host "   Machine: ${machineId}"
Write-Host "  =============================================="
Write-Host ""

if (-not (Test-Path $orca)) {
  Write-Host "  ERROR: OrcaSlicer config folder not found."
  Write-Host "  Please install OrcaSlicer first."
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "  Installing configs..."
Write-Host ""

${psLines}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   Done! Restart OrcaSlicer to load profiles."
Write-Host "  =============================================="
Write-Host ""
Read-Host "Press Enter to close"
`;

  const b64 = Buffer.from(ps, 'utf16le').toString('base64');
  return `@echo off\ntitle MakerHub — ${machineId} Installer\npowershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}\n`;
}

function generateUnix(machineId: string, relFiles: string[], serverUrl: string, os: string) {
  const orcaDir =
    os === 'mac'
      ? '$HOME/Library/Application Support/OrcaSlicer/user/default'
      : '$HOME/.config/OrcaSlicer/user/default';

  const downloads = relFiles
    .map((rel) => {
      const encodedRel = rel.split('/').map(encodeURIComponent).join('/');
      const url = `${serverUrl}/api/configs/${machineId}/${encodedRel}`;
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
# Machine: ${machineId}

ORCA="${orcaDir}"

echo ""
echo "  =============================================="
echo "   MakerHub  -  OrcaSlicer Config Installer"
echo "   Machine: ${machineId}"
echo "  =============================================="
echo ""

if [ ! -d "$ORCA" ]; then
  echo "  ERROR: OrcaSlicer not found at $ORCA"
  echo "  Please install OrcaSlicer first."
  read -rp "Press Enter to exit..."
  exit 1
fi

echo "  Installing configs..."
echo ""

${downloads}

echo ""
echo "  =============================================="
echo "   Done! Restart OrcaSlicer to load profiles."
echo "  =============================================="
echo ""
read -rp "Press Enter to close..."
`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; os: string }> }
) {
  const { id, os } = await params;
  const orcaDir = path.join(MACHINES_DIR, id, 'orcaslicer');

  if (!fs.existsSync(orcaDir)) {
    return new NextResponse('Machine not found', { status: 404 });
  }

  const relFiles = walkDir(orcaDir);
  const serverUrl =
    process.env.BASE_URL ||
    (() => {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    })();

  let content: string;
  let filename: string;

  if (os === 'windows') {
    content = generateWindows(id, relFiles, serverUrl);
    filename = `install-${id}.bat`;
  } else if (os === 'mac') {
    content = generateUnix(id, relFiles, serverUrl, 'mac');
    filename = `install-${id}.command`;
  } else {
    content = generateUnix(id, relFiles, serverUrl, 'linux');
    filename = `install-${id}.sh`;
  }

  return new NextResponse(content, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': 'application/octet-stream',
    },
  });
}
