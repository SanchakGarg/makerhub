// Client-safe: no fs/path imports here, so client components can import
// types and constants without pulling lib/storage.ts (and its Node 'fs'
// dependency) into the browser bundle. lib/storage.ts imports from this
// file, never the other way around.

export const SLICERS = ['orcaslicer', 'snapmaker-orcaslicer', 'bambustudio'] as const;
export type Slicer = (typeof SLICERS)[number];

export const SLICER_LABEL: Record<Slicer, string> = {
  orcaslicer: 'OrcaSlicer',
  'snapmaker-orcaslicer': 'Snapmaker Orca',
  bambustudio: 'Bambu Studio',
};

// Folder name is decoupled from the slicer id: retagging a machine's slicer
// (e.g. if EVA moves to the Snapmaker fork) never requires moving files on disk.
export const SLICER_FOLDER: Record<Slicer, string> = {
  orcaslicer: 'orcaslicer',
  'snapmaker-orcaslicer': 'orcaslicer',
  bambustudio: 'bambustudio',
};

export type Layer = 'seed' | 'overlay';

export interface Machine {
  id: string;
  name: string;
  brand: string;
  model: string;
  type: string;
  description: string;
  tags: string[];
  nozzle: string;
  buildVolume: string;
  extruder: string;
  accent: string;
  slicer: Slicer;
  hasSystemConfig?: boolean;
  /** Id of another machine whose orcaslicer-system folder this one reads from
   *  instead of its own — set when this printer has no vendor bundle of its
   *  own and shares a sibling's. */
  inheritsSystemConfigFrom?: string;
  hasGuide: boolean;
  hasConfig: boolean;
}
