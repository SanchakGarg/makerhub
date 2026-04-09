# June — Setup Guide

## Overview

June is a Voron 2.4 r2 with an LGX extruder, running Klipper firmware. It's a fully enclosed CoreXY printer ideal for ABS, ASA, and high-temperature materials.

## OrcaSlicer Setup

Install the configs using MakerHub, then in OrcaSlicer:

1. Select **June - Voron 2 r2 0.4 nozzle** as your machine
2. Choose a **V2 - LGX** filament profile matching your material and colour
3. Use **0.20mm Standard @June** as your starting process profile

## Materials

| Material | Profile | Notes |
|----------|---------|-------|
| ABS+ | V2 - LGX eSun ABS+ | Recommended. Keep enclosure closed. |
| PLA+ | V2 - LGX eSun PLA+ | Open door for cooling if needed. |
| PETG | V2 - LGX eSun PETG | Keep enclosure closed. |

## Starting a Print

1. Home all axes via KlipperScreen
2. Run **Bed Mesh Calibrate** before first print of the day
3. Load filament through the LGX extruder
4. Start print from OrcaSlicer or Fluidd

## Known Issues

- Update this section with any quirks specific to June.

## Maintenance

- **Nozzle:** Clean before each print session
- **Bed:** Wipe with IPA before printing ABS
- **Belt tension:** Check monthly
