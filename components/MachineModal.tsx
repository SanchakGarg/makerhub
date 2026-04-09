'use client';

import { useEffect, useState } from 'react';
import { Machine } from '@/lib/machines';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const OS_OPTIONS = [
  { key: 'windows', label: 'Windows', ext: '.bat' },
  { key: 'mac', label: 'macOS', ext: '.command' },
  { key: 'linux', label: 'Linux', ext: '.sh' },
] as const;

type OS = (typeof OS_OPTIONS)[number]['key'];

export function MachineModal({ machine, onClose }: { machine: Machine; onClose: () => void }) {
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

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white p-0 overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ backgroundColor: machine.accent }} />

        <div className="p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-2xl font-bold" style={{ fontFamily: 'var(--font-space-grotesk)' }}>{machine.name}</DialogTitle>
              <span
                className="text-xs font-mono px-2 py-0.5 rounded-full border"
                style={{ color: machine.accent, borderColor: machine.accent + '55' }}
              >
                {machine.extruder}
              </span>
            </div>
            <p className="text-sm text-zinc-400">{machine.description}</p>
          </DialogHeader>

          <Separator className="mb-4 bg-zinc-800" />

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
                <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
                <div className="text-sm font-medium">{value}</div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="install">
            <TabsList className="bg-zinc-900 border border-zinc-800 mb-4">
              <TabsTrigger value="install" className="data-[state=active]:bg-zinc-800">
                Install
              </TabsTrigger>
              <TabsTrigger value="guide" className="data-[state=active]:bg-zinc-800">
                Setup Guide
              </TabsTrigger>
            </TabsList>

            <TabsContent value="install">
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  Download and run the installer to copy OrcaSlicer configs directly into the
                  correct folders. OrcaSlicer must be installed first.
                </p>

                {/* OS picker */}
                <div className="flex gap-2">
                  {OS_OPTIONS.map((os) => (
                    <button
                      key={os.key}
                      onClick={() => setSelectedOs(os.key)}
                      className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                        selectedOs === os.key
                          ? 'border-transparent text-black'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                      style={
                        selectedOs === os.key ? { backgroundColor: machine.accent } : undefined
                      }
                    >
                      {os.label}
                    </button>
                  ))}
                </div>

                {/* Download button */}
                <a href={downloadUrl} download={filename}>
                  <Button
                    className="w-full font-semibold text-black"
                    style={{ backgroundColor: machine.accent }}
                  >
                    Download {filename}
                  </Button>
                </a>

                {/* Steps */}
                <ol className="space-y-2 text-sm text-zinc-400 list-none">
                  {selectedOs === 'windows' && (
                    <>
                      <li><span className="text-zinc-500 mr-2">1.</span>Download the <code className="text-zinc-300">.bat</code> file</li>
                      <li><span className="text-zinc-500 mr-2">2.</span>Double-click to run — allow PowerShell if prompted</li>
                      <li><span className="text-zinc-500 mr-2">3.</span>Restart OrcaSlicer to see the new profiles</li>
                    </>
                  )}
                  {selectedOs === 'mac' && (
                    <>
                      <li><span className="text-zinc-500 mr-2">1.</span>Download the <code className="text-zinc-300">.command</code> file</li>
                      <li><span className="text-zinc-500 mr-2">2.</span>Right-click → Open, then confirm in the dialog</li>
                      <li><span className="text-zinc-500 mr-2">3.</span>Restart OrcaSlicer to see the new profiles</li>
                    </>
                  )}
                  {selectedOs === 'linux' && (
                    <>
                      <li><span className="text-zinc-500 mr-2">1.</span>Download the <code className="text-zinc-300">.sh</code> file</li>
                      <li><span className="text-zinc-500 mr-2">2.</span>Run <code className="text-zinc-300">chmod +x install-{machine.id}.sh && ./install-{machine.id}.sh</code></li>
                      <li><span className="text-zinc-500 mr-2">3.</span>Restart OrcaSlicer to see the new profiles</li>
                    </>
                  )}
                </ol>
              </div>
            </TabsContent>

            <TabsContent value="guide">
              {guideHtml ? (
                <div
                  className="guide-prose max-h-96 overflow-y-auto pr-2 text-sm"
                  dangerouslySetInnerHTML={{ __html: guideHtml }}
                />
              ) : (
                <p className="text-sm text-zinc-500">Loading guide…</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
