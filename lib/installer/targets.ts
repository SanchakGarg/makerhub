import type { Slicer } from '@/lib/machines';

export type Os = 'windows' | 'mac' | 'linux';
export type Family = 'fixed-dir' | 'account-scan';

export interface SlicerTarget {
  family: Family;
  /** Exact banner text used in the generated script, e.g. "OrcaSlicer". */
  label: string;
  /** For 'fixed-dir': the literal user/system dirs per OS. */
  paths: Record<Os, { userDir: string; systemDir?: string }>;
}

export const SLICER_TARGETS: Record<Slicer, SlicerTarget> = {
  orcaslicer: {
    family: 'fixed-dir',
    label: 'OrcaSlicer',
    paths: {
      windows: {
        userDir: '$env:APPDATA\\OrcaSlicer\\user\\default',
        systemDir: '$env:APPDATA\\OrcaSlicer\\system',
      },
      mac: {
        userDir: '$HOME/Library/Application Support/OrcaSlicer/user/default',
        systemDir: '$HOME/Library/Application Support/OrcaSlicer/system',
      },
      linux: {
        userDir: '$HOME/.config/OrcaSlicer/user/default',
        systemDir: '$HOME/.config/OrcaSlicer/system',
      },
    },
  },
  // TODO(verify): the Snapmaker-branded OrcaSlicer fork's config directory
  // name has not been confirmed against a real install. Mirrors stock
  // OrcaSlicer paths for now (per user decision, "leave this for now") —
  // this is a single constant to correct once the real path is known.
  'snapmaker-orcaslicer': {
    family: 'fixed-dir',
    label: 'Snapmaker Orca',
    paths: {
      windows: {
        userDir: '$env:APPDATA\\OrcaSlicer\\user\\default',
        systemDir: '$env:APPDATA\\OrcaSlicer\\system',
      },
      mac: {
        userDir: '$HOME/Library/Application Support/OrcaSlicer/user/default',
        systemDir: '$HOME/Library/Application Support/OrcaSlicer/system',
      },
      linux: {
        userDir: '$HOME/.config/OrcaSlicer/user/default',
        systemDir: '$HOME/.config/OrcaSlicer/system',
      },
    },
  },
  bambustudio: {
    family: 'account-scan',
    label: 'Bambu Studio',
    paths: {
      windows: { userDir: '$env:APPDATA\\BambuStudio\\user' },
      mac: { userDir: '$HOME/Library/Application Support/BambuStudio/user' },
      linux: { userDir: '$HOME/.config/BambuStudio/user' },
    },
  },
};
