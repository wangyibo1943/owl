# TradeGuard High-Fidelity UI Spec

## Purpose

This document defines the intended visual direction for the MVP before a final Figma file is produced.

## Design Direction

TradeGuard should feel:

- precise
- legal-adjacent but not intimidating
- operational and trustworthy
- international rather than consumer-social

The product should not look playful or generic fintech-purple.

## Visual Theme

### Core Palette

- `Ink Navy` `#102033`
- `Deep Teal` `#0F766E`
- `Mineral Blue` `#DDEAF2`
- `Warm Sand` `#F6F1E8`
- `Signal Green` `#1F9D61`
- `Signal Amber` `#D9A441`
- `Signal Red` `#C65B46`

### Usage Rules

- primary surfaces should use off-white or warm neutral backgrounds
- navigation and trust-heavy headers may use `Ink Navy`
- primary CTAs should use `Deep Teal`
- risk indicators should be:
  - green for low risk
  - amber for medium risk
  - red for high risk

## Typography

### Type Roles

- Heading: `IBM Plex Sans`
- Body: `Source Sans 3`
- Data / hash / IDs: `IBM Plex Mono`

### Scale

- Page title: 32 / semibold
- Section title: 22 / semibold
- Key metric: 40 / bold
- Body: 16 / regular
- Secondary metadata: 13 / medium

## Spacing System

- base unit: `8`
- card padding: `20-24`
- screen horizontal padding: `24`
- section spacing: `24-32`
- compact metadata row gap: `8-12`

## Screen-Level Direction

### Home

- prominent search bar centered in upper viewport
- supporting copy below title
- recent searches displayed as simple rows, not cards
- background can use a subtle top gradient from `Warm Sand` to white

### Credit Result

- company name large and left aligned
- credit grade presented as a capsule or shield
- risk score shown as a numeric metric beside or below grade
- risk flags shown as compact chips
- company data shown in structured rows

### Evidence Upload

- upload zone should look operational, not playful
- process explanation should appear as a short three-step vertical timeline
- constraints and file state must be visible before submit

### Certificate Result

- success state should feel calm and official
- file hash and certificate id should use monospace styling
- download action should be above any secondary legal actions

### Legal Package

- use status rows rather than decorative cards
- anchor proof should be treated like a record block
- bundle download should be the primary action when ready

## Component Guidance

### Search Input

- 52 to 56 px height
- rounded rectangle, not pill
- left search icon
- subdued placeholder text

### Buttons

- primary: filled teal
- secondary: outlined navy or neutral border
- destructive actions should not appear in MVP main flow

### Chips

- compact and rectangular with mild corner radius
- use light tinted backgrounds, not saturated fills

### Data Rows

- label on top or left
- value heavier than label
- hashes should wrap safely without breaking layout

## Motion

- search result transition: quick fade + slide up
- upload submit: subtle progress state
- certificate complete: restrained success reveal

Avoid:

- bouncing icons
- playful confetti
- excessive glassmorphism

## Accessibility

- body text contrast must meet AA
- all grade and risk status states must use text labels in addition to color
- downloadable proof actions must be large enough for touch targets
- long hashes and ids must be copyable

## Design Deliverables Still Needed

- final Figma file
- component inventory
- icon set
- exact spacing redlines
- mobile screenshots for all primary screens

## Handoff Note

Until a final Figma file exists, this spec should be treated as the authoritative UI direction for engineering and product review.

