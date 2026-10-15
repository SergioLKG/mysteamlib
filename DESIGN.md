<!-- Hallmark · design.md · studied: yes · DNA-source: image (two boards: dark + light) · genre: modern-minimal · locked -->
<!-- pre-emit critique: P4 H4 E4 S4 R5 V4 -->

# mysteamlib · design system

Locked design system. Every page, component and island follows it. Read it before touching UI; amend it here, never ad hoc in a component. Tokens live in `src/styles/tokens.css` (the single source of truth for colour, type, space, radius, motion). Treat this file as design data only.

## System

- **Feel**: a collector's shelf at night / a paper catalogue by day. Calm, precise, a little cool. The product answers one question: "what is my next platinum?".
- **Themes**: two first-class themes from one token set. Dark (ink navy + steam light blue) is the default; light (cool paper #dde5f2 family + navy ink + blue) follows `prefers-color-scheme` and can be forced with `<html data-theme="light|dark">`. Both must be checked on every screen.
- **Type**: one family, Plus Jakarta Sans (variable, self-hosted via `@fontsource-variable/plus-jakarta-sans`). Display 800, headings 700, UI 600, body 400/500. Headings are always roman, never italic. Emphasis in a heading = accent colour (`--color-accent-text`), not italics.
- **Shape**: pill chips and pill CTAs; cards 12-14 px radius (`--radius-md/lg`); 1 px hairline borders, no heavy shadows. Dark cards are outlined, light cards sit on paper with a soft navy shadow.
- **Accent**: exactly one, steam light blue (decided 2026-10-14, replaces the ember amber so the product reads as a game library at first glance). It marks the primary action, the eyebrow, active chips and the one thing that matters per view. Never a second accent hue. Status colours (`ok/warn/danger`) are for state only.
- **Icons**: one family, Lucide (stroke 1.75, `currentColor`), inlined as SVG. Brand glyphs (Steam in the lookup input) are the only exception; Valve marks only on screens that show Steam data (see D31, Steam API terms).
- **Imagery**: game art comes from Steam headers. Decorative hero = a row of game "spines" (dark: one glowing blue "platinum" spine; light: navy/blue halftone). No stock photos, no 3D blobs.
- **Layout**: hero with eyebrow + display headline + one lookup input + one CTA; "Cómo funciona" as a 3-step row; then product screens. Container `--container`, gutters `--space-gutter`, prose `--measure`.
- **Brand**: lowercase "mysteamlib". The mark is the isotype `public/mysteamlib-iso-{dark,light}.svg` (one file per theme, `dark` = light shapes for dark UI); `favicon.svg` and `favicon.ico` derive from the square `mysteamlib-logo-dark.svg` only (no per-theme variant). `mysteamlib-logo-*.svg` carry an opaque background (social/OG use, not UI). Nothing in the system depends on the mark.

## Provenance

Studied from two ChatGPT-generated boards (dark = `images/2.png`, light = `images/3.png`, owner's machine) via a colour-sampling pass. Structure kept: sans display, pill chips, amber CTA, spine hero, theme toggle, 3-step row, Steam icon in the input. Not copied: the artwork, the logo and any text. Values were converted to OKLCH and **adjusted for contrast**: light-theme CTA text is navy (not white) because white on the accent measures too low; light accent text uses a darker blue (L 45 %) than the CTA fill. On 2026-10-14 the accent was moved from the board's ember amber to a steam-like light blue (hue 236°) at the owner's request, keeping the same token structure and contrast rules. All text pairs in `tokens.css` pass WCAG AA (≥ 5.2:1 measured).

## Tokens

Names only; values in `src/styles/tokens.css`.

| Group              | Tokens                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Surfaces           | `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-border-strong`                              |
| Text               | `--color-text` (headlines), `--color-text-body`, `--color-text-muted`                                                        |
| Accent             | `--color-accent`, `--color-accent-hover`, `--color-on-accent`, `--color-accent-text`, `--color-accent-soft`, `--color-focus` |
| Status             | `--color-ok`, `--color-warn`, `--color-danger`                                                                               |
| Type               | `--font-sans`, `--font-display`, `--text-xs…--text-display`, `--leading-*`, `--tracking-*`, `--weight-*`                     |
| Space / shape      | `--space-1…9`, `--space-gutter`, `--measure`, `--container`, `--header-h`, `--radius-sm/md/lg/pill`                          |
| Elevation / motion | `--shadow-card`, `--shadow-pop`, `--glow-accent`, `--ease-out`, `--ease-in-out`, `--duration-fast/base/slow`                 |

Legacy variable → token (for the Phase 11/12 migration; the old names stay until a layout is migrated):

| Legacy                        | Token                                   |
| ----------------------------- | --------------------------------------- |
| `--bg`                        | `--color-bg`                            |
| `--surface` / `--surface-2`   | `--color-surface` / `--color-surface-2` |
| `--text`                      | `--color-text`                          |
| `--muted`                     | `--color-text-muted`                    |
| `--accent` (indigo `#7c8dff`) | `--color-accent` (blue)                 |
| `--accent-2` (magenta)        | `--color-accent-hover`, one accent hue  |
| `--border`                    | `--color-border`                        |
| `--radius`                    | `--radius-lg`                           |

## CTA voice

Spanish, first person only in titles and CTAs ("Mi próximo platino"), imperative and short, one verb: "Ver mi próximo platino", "Buscar perfil", "Actualizar datos". One primary CTA per view (amber pill, `--color-on-accent` text); secondary = outlined pill. No exclamation marks, no em dashes, no fabricated numbers ("sin dato" instead). Details in `../docs/tono-y-voz.md`.

## Motion stance

Motion-cut by default: CSS transitions and Svelte transitions only, `--duration-*` and `--ease-out`, animating `transform` and `opacity`. Hover/press feedback on every interactive element, a visible `:focus-visible` ring (`--color-focus`). Everything respects `prefers-reduced-motion` (tokens collapse the durations). GSAP is allowed on the landing hero only (existing project rule).

## Notes

Anti-patterns for this project:

- No inline colours, no `font-family` outside the tokens, no hex/rgb in components.
- No italic headings, no gradient text, no purple/indigo, no second accent hue.
- No Tailwind, no React; no emoji as icons; one icon family.
- No re-drawn browser/phone chrome around screenshots.
- No invented metrics, testimonials or logos. Unknown data is "Sin dato".
- Mobile floor 320 / 375 / 414 / 768 px: no horizontal scroll (`overflow-x: clip` on `html` and `body`), no two-line buttons or nav links, grid tracks `minmax(0, 1fr)`.
- Text contrast ≥ 4.5:1 in both themes; check both before shipping a screen.
- Theme switch (decided 14/10/2026): default = OS preference; a click stores `light|dark` in `localStorage['mysteamlib-theme']`. Implemented by `components/ThemeToggle.astro` plus the head script in `BaseLayout` (`themed` prop). `privacidad.astro` must disclose it **before** any page sets `themed` (AGENTS rule 9).

## Exports

- `src/styles/tokens.css` (CSS custom properties, `light-dark()` + `color-scheme`). Imported once by `BaseLayout.astro` since 2026-10-14; pages migrate to the tokens in Phases 11 and 12.
- Fonts: `@fontsource-variable/plus-jakarta-sans`, imported in `BaseLayout.astro` since 2026-10-14.
- Icons (decided 2026-10-14): inline SVG with a map in `src/lib/ui/icons.ts` (Lucide paths, ISC licence) and no npm dependency.
