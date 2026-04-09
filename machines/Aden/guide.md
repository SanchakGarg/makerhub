# Aden — Setup Guide

## Overview

Aden is a Voron 2.4 r2 with a CW2 (Clockwork 2) extruder, running Klipper firmware. Fully enclosed CoreXY printer.

## OrcaSlicer Setup

Install the configs using MakerHub, then in OrcaSlicer:

1. Select **Aden - Voron 2 r2 0.4 nozzle** as your machine
2. Choose a **V2 - CW2 @Aden** filament profile matching your material
3. Use **0.20mm Standard @Aden** as your starting process profile

## Materials

| Material | Profile | Notes |
|----------|---------|-------|
| ABS+ | V2 - CW2 @Aden eSun ABS+ | Keep enclosure closed. |

## Starting a Print

1. Home all axes via KlipperScreen
2. Run **Bed Mesh Calibrate** before first print of the day
3. Load filament through the CW2 extruder
4. Start print from OrcaSlicer or Fluidd

## Maintenance

- **Nozzle:** Clean before each print session
- **Bed:** Wipe with IPA before printing ABS
- **Belt tension:** Check monthly
