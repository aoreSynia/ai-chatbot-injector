# PLAN-tftacademy-support.md - Support for Metadata-Heavy Gaming Sites

## Goal
Enhance the Universal Scanner to support sites like `tftacademy.com` where the most important information (Champions, Items, Comps) is stored in attributes (`aria-label`, `alt`) rather than visible `innerText`.

## The Problem
- **Low Text Density**: The site uses icons/images for 80% of its data.
- **Generic HTML**: Uses `<div>` and `<span>` without semantic markers (`main`, `article`).
- **Data in Attributes**: Champion names are often in `aria-label` or image `alt` text.

## Proposed Changes

### 1. Update `scanner.js`
- **Dynamic Attribute Capture**: When scanning "Game Sites", include `aria-label` and `alt` text in the density scoring.
- **Specific Selector for TFTAcademy**: Add a targeted logic for `.comps-list` or specific comp grids to extract the "Build" structure.
- **Fall-back to body**: If no semantic containers are found, the scanner should perform a "Deep Scan" on all `div` containers with high metadata count.

### 2. Enhanced Extraction Logic
- Implement a `getMetadataText(element)` helper that returns `innerText + aria-label + alt`.
- Use this helper specifically when a site is identified as a "Game Wiki" or "Tactics Site".

## Verification Plan

### Manual Verification
- **Test on TFTAcademy**: Run the new scanner and verify that champion names (e.g., "Sera", "Zac") and item names (e.g., "Rabaddon", "Blue Buff") appear in the debug context.

## User Review Required
> [!IMPORTANT]
> **Noise Level**: Inclusion of all `aria-label`s and `alt` tags can significantly increase the "noise" (e.g., "Icon of a sword", "Close button").
> We should only enable this for specific domains or containers. Do you have other gaming sites (e.g., op.gg, u.gg) you want us to support with this?
