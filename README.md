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

## Admin mode

Signed-in users can manage printers directly from the UI:

- Browse, delete, and upload filament/process/machine configs per printer (and the
  vendor system-config bundle, where present).
- Uploads are checked against the target printer's `compatible_printers`/`inherits`/
  `printer_settings_id` before being accepted — a config that clearly belongs to a
  different printer is rejected; one with no resolvable signal asks for confirmation.
- Edit a printer's metadata and accent color.
- Create a new printer by uploading its machine profile, name, description, accent
  color, and slicer software (OrcaSlicer, Snapmaker Orca, or Bambu Studio) — an
  installer script is generated for it immediately.

Admin writes never touch the git-tracked `machines/` tree — they go into a separate
`data/` directory (gitignored, bind-mounted in Docker) that is merged with `machines/`
at read time. This means `./update.sh`'s `git pull` never conflicts with admin edits.
Deleting a file that ships with MakerHub hides it (with a Restore option); it isn't
removed from disk.

### Zitadel setup

Login is Authorization Code + PKCE against a Zitadel OIDC instance, with a JWT access
token verified server-side. **Any user who successfully authenticates gets full admin
access** — there are no roles or an email allowlist in the app. This means access
control lives entirely in Zitadel's project grant, and getting it right matters:

1. In the Zitadel console, on the application:
   - Set **Token Type = JWT** (an opaque token will fail verification).
   - Application type: public client (no client secret), PKCE.
   - Redirect URI: `${BASE_URL}/api/auth/callback` (exact scheme/host/port/path — add
     `http://localhost:3000/api/auth/callback` too for local dev).
   - Post-logout redirect URI: `${BASE_URL}/`.
2. On the **project**, enable **"Check for Project on Authentication"**
   (`hasProjectCheck`). Without this, any user in the org can complete login and
   receive a valid token, regardless of whether they were granted the app.
3. On the **org's login policy**, disable self-registration — otherwise anyone can
   create an account and pass step 2 trivially.
4. Grant the application to exactly the people who should be able to edit printers.
5. Verify by creating a throwaway user with **no** grant on this project and confirming
   login fails at Zitadel, not just in the app.

---

## Environment variables

| Variable              | Default                     | Description                                                                 |
|------------------------|-----------------------------|-----------------------------------------------------------------------------|
| `PORT`                 | `3000`                      | Port the server listens on                                                  |
| `BASE_URL`             | auto-detected from request  | Public URL of this server. Used in generated installer scripts **and** as the OIDC redirect base — required for login to work |
| `ZITADEL_ISSUER`       | —                            | Zitadel instance URL, no trailing slash. Required for admin login.         |
| `ZITADEL_CLIENT_ID`    | —                            | Zitadel application client ID (public client, PKCE, Token Type = JWT).     |
| `ZITADEL_AUDIENCE`     | `ZITADEL_CLIENT_ID`          | Override if Zitadel's access token `aud` claim doesn't match the client ID. |
| `AUTH_COOKIE_SECURE`   | derived from `BASE_URL`      | Force the session cookie's `Secure` flag on/off. Leave unset unless behind a TLS-terminating proxy. |
| `MAKERHUB_DATA_DIR`    | `<cwd>/data`                 | Where admin-written data (uploaded configs, printer edits) is stored.       |

Example with a custom domain:

```bash
BASE_URL=https://makerhub.local bun start
```

### Data directory

`data/` holds everything admins write through the UI: uploaded/edited config files,
printer metadata patches, newly-created printers, and tombstones for deleted seed
files. It's gitignored and, in Docker, bind-mounted separately from `machines/`. Back
it up with `tar czf backup.tgz data/`.

**Known caveat:** the Dockerfile does not create a non-root user, so the container
writes to the `./data` bind mount as root. This has not been verified in this
environment (no Docker daemon was available while building this feature) — if files
under `./data` end up root-owned on the host and that's a problem for you, either run
the container with `user: "$(id -u):$(id -g)"` in `docker-compose.yml`, or `chown` the
directory after first run.

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
    auth/                       # login / callback / logout / session (Zitadel PKCE)
    admin/machines/             # printer + config CRUD (auth-gated)
components/
  MachineGrid.tsx
  MachineCard.tsx
  MachineModal.tsx
  AuthProvider.tsx / AuthButton.tsx
  admin/                        # ConfigManager, EditPrinterDialog, CreatePrinterWizard, AccentPicker
  ui/                           # shadcn/ui components
lib/
  machines.ts                   # client-safe types + constants (no fs dependency)
  storage.ts                    # seed (machines/) + overlay (data/) merge, all reads/writes
  validate.ts                   # upload printer-binding validation
  color.ts                      # accent contrast helpers
  auth/                         # OIDC discovery, PKCE, JWT verification
  installer/                    # per-slicer installer script generation
machines/                       # seed data, git-tracked, read-only at runtime
  machines.json
  June/orcaslicer/...
  November/orcaslicer/...
data/                           # admin-written overlay, gitignored (see "Data directory")
```
