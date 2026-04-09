# MakerHub

Web app for the makerspace — browse 3D printers, read setup guides, and install OrcaSlicer configs with one click.

Built with **Next.js**, **shadcn/ui**, and **Tailwind CSS v4**.

---

## Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- [OrcaSlicer](https://github.com/SoftFever/OrcaSlicer) installed on end-user machines

---

## Setup

```bash
# Install dependencies
bun install

# Development server (hot reload)
bun dev

# Production build
bun run build

# Start production server
bun start
```

Server runs at **http://localhost:3000** by default.

To run on a different port:

```bash
PORT=8080 bun start
```

---

## Adding a printer

1. Add an entry to `machines/machines.json`:
   ```json
   {
     "id": "MachineName",
     "name": "MachineName",
     "brand": "Voron Design",
     "model": "Voron 2.4 r2",
     "type": "CoreXY",
     "description": "Short description.",
     "tags": ["CoreXY", "Klipper", "Enclosed"],
     "nozzle": "0.4mm",
     "buildVolume": "350 × 350 × 350 mm",
     "extruder": "LGX",
     "accent": "#EAB308",
     "hasGuide": true,
     "hasConfig": true
   }
   ```

2. Create the config folder mirroring OrcaSlicer's structure:
   ```
   machines/MachineName/
     orcaslicer/
       machine/base/   <- machine profile .json + .info
       filament/base/  <- generic filament templates
       filament/       <- specific filament profiles
       process/base/   <- process templates
       process/        <- named print quality profiles
     guide.md          <- setup guide (optional)
   ```

3. Copy files from `%APPDATA%\OrcaSlicer\user\default\` (Windows) or
   `~/Library/Application Support/OrcaSlicer/user/default/` (macOS) into the matching subfolders.

---

## How installers work

When a user clicks **Download** in the UI, the server generates a script on the fly:

- **Windows** — `.bat` that runs an embedded PowerShell script via `-EncodedCommand` (UTF-16LE base64). No `%` escaping issues. Just double-click.
- **macOS** — `.command` bash script. Right-click then Open to run.
- **Linux** — `.sh` bash script. `chmod +x` then run.

Scripts pull configs directly from this server via `curl` / `Invoke-WebRequest`.

---

## Environment variables

| Variable   | Default                     | Description                                                                 |
|------------|-----------------------------|-----------------------------------------------------------------------------|
| `PORT`     | `3000`                      | Port the server listens on                                                  |
| `BASE_URL` | auto-detected from request  | Override the server URL used in generated installer scripts (useful behind a reverse proxy) |

Example with a custom domain:

```bash
BASE_URL=https://makerhub.local bun start
```

---

## Project structure

```
app/
  page.tsx                      # Home page (server component)
  layout.tsx
  globals.css
  api/
    machines/route.ts           # GET /api/machines
    machines/[id]/guide/        # GET /api/machines/:id/guide
    configs/[id]/[...path]/     # GET /api/configs/:id/* (file serving)
    installer/[id]/[os]/        # GET /api/installer/:id/:os (script generation)
components/
  MachineGrid.tsx
  MachineCard.tsx
  MachineModal.tsx
  ui/                           # shadcn/ui components
lib/
  machines.ts                   # shared types + helpers
machines/
  machines.json
  June/orcaslicer/...
  November/orcaslicer/...
```
