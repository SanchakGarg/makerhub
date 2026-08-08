'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Machine, SLICER_LABEL } from '@/lib/machines';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Settings2 } from 'lucide-react';
import { withAlpha, readableInk } from '@/lib/color';
import { useAuth } from '@/components/AuthProvider';

function CopyBox({ command }: { command: string }) {
  const copy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(command).then(() => toast.success('Copied to clipboard'));
    } else {
      const el = document.createElement('textarea');
      el.value = command;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      toast.success('Copied to clipboard');
    }
  };
  return (
    <div className="flex items-center gap-2 bg-muted border border-border rounded-md px-3 py-2 mt-1">
      <code className="text-foreground text-xs flex-1 break-all font-mono">{command}</code>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={copy}
      >
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

const OS_OPTIONS = [
  { key: 'windows', label: 'Windows', ext: '.bat' },
  { key: 'mac', label: 'macOS', ext: '.command' },
  { key: 'linux', label: 'Linux', ext: '.sh' },
] as const;

type OS = (typeof OS_OPTIONS)[number]['key'];

export function MachineModal({
  machine,
  machines,
  onClose,
}: {
  machine: Machine;
  machines: Machine[];
  onClose: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const [guideHtml, setGuideHtml] = useState('');
  const [selectedOs, setSelectedOs] = useState<OS>('windows');

  useEffect(() => {
    fetch(`/api/machines/${machine.id}/guide`)
      .then((r) => r.json())
      .then((d) => setGuideHtml(d.html || ''))
      .catch(() => setGuideHtml('<p>Could not load guide.</p>'));
  }, [machine.id]);

  const osOption = OS_OPTIONS.find((o) => o.key === selectedOs)!;
  const downloadUrl = `/api/installer/${machine.id}/${selectedOs}`;
  const filename = `install-${machine.id}${osOption.ext}`;
  const slicerName = SLICER_LABEL[machine.slicer];
  const accentInk = readableInk(machine.accent);
  const inheritedFrom = machine.inheritsSystemConfigFrom
    ? machines.find((m) => m.id === machine.inheritsSystemConfigFrom)
    : null;
  const inheritedFromLabel = inheritedFrom?.name ?? machine.inheritsSystemConfigFrom ?? '';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card border-border p-0 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: machine.accent }} />

        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>
                {machine.name}
              </DialogTitle>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full border"
                style={{ color: machine.accent, borderColor: withAlpha(machine.accent, '55') }}
              >
                {machine.extruder}
              </span>
              {isAuthenticated && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  title="Open admin settings for this printer"
                  render={<Link href={`/admin/printers/${machine.id}`} />}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Manage
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{machine.description}</p>
          </DialogHeader>

          <Separator className="mb-4" />

          {/* Specs row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              ['Brand', machine.brand],
              ['Model', machine.model],
              ['Nozzle', machine.nozzle],
              ['Build Volume', machine.buildVolume],
              ['Type', machine.type],
              ['Extruder', machine.extruder],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
                <div className="text-sm font-medium">{value}</div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="install">
            <TabsList className="mb-4">
              <TabsTrigger value="install">Install</TabsTrigger>
              <TabsTrigger value="guide">Setup Guide</TabsTrigger>
            </TabsList>

            <TabsContent value="install">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Download and run the installer to copy configs directly into the correct folders.{' '}
                  <span className="text-foreground font-medium">{slicerName}</span> must be
                  installed first.
                </p>

                {/* OS picker */}
                <div className="flex gap-2">
                  {OS_OPTIONS.map((os) => (
                    <button
                      key={os.key}
                      onClick={() => setSelectedOs(os.key)}
                      className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                        selectedOs === os.key
                          ? 'border-transparent'
                          : 'border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
                      }`}
                      style={selectedOs === os.key ? { backgroundColor: machine.accent, color: accentInk } : undefined}
                    >
                      {os.label}
                    </button>
                  ))}
                </div>

                {/* Download button */}
                <a href={downloadUrl} download={filename}>
                  <Button className="w-full font-semibold" style={{ backgroundColor: machine.accent, color: accentInk }}>
                    Download {filename}
                  </Button>
                </a>

                {/* Steps */}
                <ol className="space-y-2 text-sm text-muted-foreground list-none">
                  {selectedOs === 'windows' && (
                    <>
                      <li><span className="text-muted-foreground/60 mr-2">1.</span>Download the <code className="text-foreground">.bat</code> file</li>
                      <li><span className="text-muted-foreground/60 mr-2">2.</span>Double-click to run — allow PowerShell if prompted</li>
                      <li><span className="text-muted-foreground/60 mr-2">3.</span>Restart {slicerName} to see the new profiles</li>
                    </>
                  )}
                  {selectedOs === 'mac' && (
                    <>
                      <li><span className="text-muted-foreground/60 mr-2">1.</span>Download the <code className="text-foreground">.command</code> file</li>
                      <li>
                        <span className="text-muted-foreground/60 mr-2">2.</span>Open Terminal and run:
                        <CopyBox command={`xattr -d com.apple.quarantine ~/Downloads/${filename} && chmod +x ~/Downloads/${filename}`} />
                        <span className="text-muted-foreground/50 text-xs mt-1 block">
                          If your browser saved it with a different name, replace <code className="text-muted-foreground">{filename}</code> with the actual filename.
                        </span>
                      </li>
                      <li><span className="text-muted-foreground/60 mr-2">3.</span>Double-click the file to run it</li>
                      <li><span className="text-muted-foreground/60 mr-2">4.</span>Restart {slicerName} to see the new profiles</li>
                    </>
                  )}
                  {selectedOs === 'linux' && (
                    <>
                      <li><span className="text-muted-foreground/60 mr-2">1.</span>Download the <code className="text-foreground">.sh</code> file</li>
                      <li>
                        <span className="text-muted-foreground/60 mr-2">2.</span>Open Terminal and run:
                        <CopyBox command={`chmod +x ~/Downloads/${filename} && ~/Downloads/${filename}`} />
                        <span className="text-muted-foreground/50 text-xs mt-1 block">
                          If your browser saved it with a different name, replace <code className="text-muted-foreground">{filename}</code> with the actual filename.
                        </span>
                      </li>
                      <li><span className="text-muted-foreground/60 mr-2">3.</span>Restart {slicerName} to see the new profiles</li>
                    </>
                  )}
                </ol>

                {machine.inheritsSystemConfigFrom && (
                  <div className="rounded-md border border-border bg-muted px-3 py-2.5 text-sm">
                    <p className="font-medium text-foreground">One more step in {slicerName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      This printer shares its vendor system profiles with{' '}
                      <span className="text-foreground font-medium">{inheritedFromLabel}</span>. Open{' '}
                      <span className="text-foreground">Printer Settings</span>, and in the printer selection
                      step, pick <span className="text-foreground font-medium">{inheritedFromLabel}</span>{' '}
                      instead of {machine.name} — that&rsquo;s where the system profiles are registered.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="guide">
              {guideHtml ? (
                <div
                  className="guide-prose max-h-96 overflow-y-auto pr-2 text-sm"
                  dangerouslySetInnerHTML={{ __html: guideHtml }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Loading guide…</p>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
