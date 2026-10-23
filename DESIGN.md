<!-- Hallmark · design.md · studied: yes · DNA-source: image (two boards: dark + light) · genre: modern-minimal · locked · amended 2026-10-22 (brand v2: shelf motif, data-first) and 2026-10-23 (genre inks, interactive shelf) -->
<!-- pre-emit critique: P4 H4 E4 S4 R5 V4 -->

# mysteamlib · design system

Locked design system. Every page, component and island follows it. Read it before touching UI; amend it here, never ad hoc in a component. Tokens live in `src/styles/tokens.css` (the single source of truth for colour, type, space, radius, motion). Treat this file as design data only.

## System

- **Feel**: a collector's shelf at night / a paper catalogue by day. Calm, precise, a little cool. The product answers one question: "what is my next platinum?".
- **Themes**: two first-class themes from one token set. Dark (ink navy + steam light blue) is the default; light (cool paper #dde5f2 family + navy ink + blue) follows `prefers-color-scheme` and can be forced with `<html data-theme="light|dark">`. Both must be checked on every screen.
- **Type**: one family, Plus Jakarta Sans (variable, self-hosted via `@fontsource-variable/plus-jakarta-sans`). Display 800, headings 700, UI 600, body 400/500. Headings are always roman, never italic. Emphasis in a heading = accent colour (`--color-accent-text`), not italics.
- **Principles** (amended 2026-10-22; the brand is "the shelf that is yours"):
  1. **One motif, zero ornament.** Spines are always data or a divider. No bar without meaning.
  2. **The only image is game art** (Steam) **or `public/placeholder.svg`.** No generated illustrations, stock or banners.
  3. **Bookmark**: at most 3 per screen, only for "mine" or "next platinum". It is the **only** glow.
  4. **One filled primary CTA per view**; everything else is outlined.
  5. **Colour with a function**: blue = action, selection, bookmark; green = "completed" only; data in neutral ink. State is never colour alone: always outline, hatch or solid.
  6. **Figures lead**: stat tokens, `tabular-nums`, weight 700, tight tracking; the label sits below in muted.
  7. **No icons on section titles or tags.**
  8. **1 px borders.** Strong border and glow only on the marked element (and on form controls, which need 3:1).
- **Shape**: pill chips and pill CTAs; cards 12-14 px radius (`--radius-md/lg`); 1 px hairline borders, no heavy shadows. Dark cards are outlined, light cards sit on paper with a soft navy shadow.
- **Accent**: exactly one, steam light blue (decided 2026-10-14, replaces the ember amber so the product reads as a game library at first glance). It marks the primary action, the eyebrow, active chips and the one thing that matters per view. Never a second accent hue. Status colours (`ok/warn/danger`) are for state only.
- **Icons**: one family, Lucide (stroke 1.75, `currentColor`), inlined as SVG. Brand glyphs (Steam in the lookup input) are the only exception; Valve marks only on screens that show Steam data (see D31, Steam API terms).
- **Imagery**: the only imagery is Steam game art (`header_image_url`, with `width`/`height` and `loading="lazy"`, `alt` = game name) or `public/placeholder.svg`. The placeholder is transparent and neutral and follows the theme through its container: always `object-fit: cover` on `background: var(--color-surface-2)` with `alt=""`. The hero has no images (LCP = text); its spines are CSS shapes built from tokens. No stock photos, no 3D blobs, no generated illustrations, no banner over the profile card.
- **Layout**:
  - Landing: eyebrow (accent text, no pill) + display headline ("estante" in `--color-accent-text`, roman, 2 lines) + one fused lookup input and CTA with a **visible label** (hero text stack: eyebrow, headline, sub of ≤ 20 words, input + CTA; no tagline or trust strip under the CTA), then the 2-state shelf, "Mis herramientas", FAQ and footer. Header login = outlined pill, so the hero keeps the single filled CTA.
  - Signed-in zone: tabs under the header, bottom bar on mobile (`aria-current` on both). No sidebar. The hero of the dashboard is "Mi próximo platino", not the profile banner.
  - Container `--container`, gutters `--space-gutter`, prose `--measure`. Grid tracks `minmax(0, 1fr)`; KPIs go 2×2 on mobile.
  - "Ficha" ruling (horizontal lines + margin line, `--color-rule`, `--rule-gap`) only behind the hero and footer `--color-bg`, never behind dense text and never in the dashboard.
- **Brand**: lowercase "mysteamlib". The mark is the isotype `public/mysteamlib-iso-{dark,light}.svg` (one file per theme, `dark` = light shapes for dark UI); `favicon.svg` and `favicon.ico` derive from the square `mysteamlib-logo-dark.svg` only (no per-theme variant). `mysteamlib-logo-*.svg` carry an opaque background (social/OG use, not UI). Nothing in the system depends on the mark.

## Data display

- **Spine states** (shelf and legend, counts in the legend): *empty* = outline in `--color-spine-empty`; *started* = `--pattern-started` hatch; *played* (landing only, 2 states) = solid `--color-spine-played`; *done* = solid `--color-spine-done`. Height = hours. Blue never encodes state; it is reserved for the bookmarked spine (`--color-accent-mark`, `--glow-bookmark`).
- **Genre ink** (amended 2026-10-23, owner's request): when the service gives genres, a spine takes the ink of its most specific coloured genre (`gameInk` in `lib/ui/genres.ts`): the border for *empty*, border and fill for *started* and *played*. *Done* keeps `--color-spine-done`. Genres without their own ink and games without data keep the neutral state colours. The ink is a second signal, never the only one: every ink is named in the genre legend and in the tooltip, and state still reads as outline vs fill. The hues skip 211–261° (blue stays the bookmark's).
- **Interactive shelf**: hovering, touching (drag) or focusing a spine opens one tooltip card (cover, name, hours, last two weeks, state, genres with their dot). Keyboard: one tab stop, arrows, Home/End, Esc; each spine is a button with a full `aria-label`. The visually hidden table is dropped (see Charts). With 60 spines each column is about 5 px wide at 320 px, below the 44 px rule and the 24 px WCAG 2.5.8 floor: an open exception, compensated by the full-height hit area, the drag across the shelf, the arrow keys and the library list below. To revisit if the owner wants a single slider-style control on touch.
- **User title**: chip "( Civil )" next to the name in the library card, from the most played genre with a nickname (`GENRE_TITLES`); tooltip with the percentage. Text only, no icon, and omitted when fewer than half of the hours have genre data.
- **Stat figure**: figure in `--text-stat` (`--text-stat-sm` inside cards) + label below in muted. A card never shows an empty ring or "Sin dato" as a genre: when there is no data, the group is omitted (level and "socio desde" are omitted on private profiles).
- **Charts**: direct labels, no sparklines, no decoration. Hours per genre = horizontal bars with the value at the end of each bar. Every chart is a `<figure>` with a summary `<figcaption>` ("312 juegos: 18 sin jugar…") and a visually hidden equivalent table. Exception (2026-10-23): the shelf has no table; each spine is a button whose `aria-label` carries name, hours, state and genres.
- **Tables / lists**: "Jugado hace poco" is a table on desktop and a two-line list on mobile. One hairline under the header; rows are separated by spacing, not a border per row.
- Unknown data is `null` and renders "Sin dato" (rule 7). Sample figures from mockups never reach the UI.

## Motifs

- **Spine**: the single recurring shape (vertical rounded bar). Variants: data spine, bookmarked spine (raised from the shelf + vertical label "Mi próximo platino" + ribbon on top) and the footer silhouette (static, `aria-hidden`, one spine marked, next to the Valve non-affiliation disclaimer).
- **Tag** ("tejuelo"): small outlined label, no icon. "En camino" for tools not built yet.
- **Rail of tools**: icon, title, one line and tag; arrows only when it overflows; on mobile `scroll-snap` without arrows.
- Out: left-edge decorative bars, sparklines, glow on more than one element, Steam logo crossed out, illustrated capsules.

## Provenance

Studied from two ChatGPT-generated boards (dark = `images/2.png`, light = `images/3.png`, owner's machine) via a colour-sampling pass. Structure kept: sans display, pill chips, amber CTA, spine hero, theme toggle, 3-step row, Steam icon in the input. Not copied: the artwork, the logo and any text. Values were converted to OKLCH and **adjusted for contrast**: light-theme CTA text is navy (not white) because white on the accent measures too low; light accent text uses a darker blue (L 45 %) than the CTA fill. On 2026-10-14 the accent was moved from the board's ember amber to a steam-like light blue (hue 236°) at the owner's request, keeping the same token structure and contrast rules. All text pairs in `tokens.css` pass WCAG AA (≥ 4.5:1 measured). Brand v2 amendment (2026-10-22, plan in `../docs/rediseno-marca-v2.md`) re-measured every pair in both themes: `--color-border-strong` and the graphic use of `--color-accent` failed the 3:1 non-text floor, so the first was darkened and `--color-accent-mark` was added for graphics.

## Tokens

Names only; values in `src/styles/tokens.css`.

| Group              | Tokens                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Palette (raw)      | `--ink-16…82` (10), `--paper-82…99` (5), `--steam-45…82` (6), `--moss-45/78`, `--amber-50/82`, `--coral-48/72`: 27 values, six families, plus the genre family `--genre-<name>-47/74` (7 hues × 2 steps, added 2026-10-23), **only in `tokens.css`** |
| Surfaces           | `--color-bg`, `--color-surface`, `--color-surface-2`, `--color-border`, `--color-border-strong`                              |
| Text               | `--color-text` (headlines), `--color-text-body`, `--color-text-muted`                                                        |
| Accent             | `--color-accent`, `--color-accent-hover`, `--color-on-accent`, `--color-accent-text`, `--color-accent-soft`, `--color-focus` |
| Status             | `--color-ok`, `--color-warn`, `--color-danger`                                                                               |
| Type               | `--font-sans`, `--font-display`, `--text-xs…--text-display`, `--leading-*`, `--tracking-*`, `--weight-*`                     |
| Space / shape      | `--space-1…9`, `--space-gutter`, `--measure`, `--container`, `--header-h`, `--radius-sm/md/lg/pill`                          |
| Elevation / motion | `--shadow-card`, `--shadow-pop`, `--glow-accent`, `--glow-bookmark`, `--ease-out`, `--ease-in-out`, `--duration-fast/base/slow` |
| Graphics           | `--color-accent-mark` (non-text blue), `--color-spine-empty/played/done`, `--color-genre-*` (7), `--pattern-started`         |
| Stat / ficha       | `--text-stat`, `--text-stat-sm`, `--tracking-stat`, `--color-rule`, `--rule-gap`                                             |

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

Spanish, first person only in titles and CTAs ("Mi próximo platino"), imperative and short, one verb: "Ver mi próximo platino", "Buscar perfil", "Actualizar datos". One primary CTA per view (filled accent pill, `--color-on-accent` text); secondary = outlined pill. No exclamation marks, no em dashes, no fabricated numbers ("sin dato" instead). Details in `../docs/tono-y-voz.md`.

## Motion stance

Motion-cut by default: CSS transitions and Svelte transitions only, `--duration-*` and `--ease-out`, animating `transform` and `opacity`. Hover/press feedback on every interactive element, a visible `:focus-visible` ring (`--color-focus`). Everything respects `prefers-reduced-motion` (tokens collapse the durations). GSAP is allowed on the landing hero only (existing project rule).

## Notes

Anti-patterns for this project:

- **Closed brand palette.** The web is built only from the palette families in `tokens.css` (ink, paper, steam, moss, amber, coral, plus the genre family for spines and the genre legend only). Components use the semantic tokens (`--color-*`), never `--ink-*`/`--steam-*` directly and never a literal colour. Allowed exceptions: gradients and alpha overlays built from palette steps (`color-mix(in oklch, var(--…) N%, transparent)`), the pure-black pop shadow in dark, and the system keywords of the `forced-colors` block. A new colour means a new palette step (with its contrast measured), not an inline value.
- No inline colours, no `font-family` outside the tokens, no hex/rgb in components.
- No generated illustrations, stock or banners; no decorative spines, left-edge bars or sparklines; no icon beside a section title or tag; no glow except the bookmark; no second filled CTA in a view; no state conveyed by colour alone.
- Inputs always have a visible label (placeholder is not a label); live results and errors in `aria-live`; touch targets ≥ 44 px on mobile.
- Non-text contrast ≥ 3:1 (spines, bars, input borders, focus ring) in both themes and visible under `forced-colors`; reflow at 320 px and 200 % zoom.
- Deliberate exceptions to the generic anti-slop checklist (design-taste-frontend), approved by the owner on 2026-10-22: the vertical "Mi próximo platino" label (it names real data), the "ficha" ruling (hero and footer only) and the single bookmark glow. Nothing else decorative gets these.
- Client-only Svelte components carry `<svelte:options css="injected" />`.
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
