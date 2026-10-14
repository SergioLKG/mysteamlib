/**
 * Browser-chrome colours for `<meta name="theme-color">`. The meta tag cannot read
 * CSS custom properties, so the sRGB approximations of the tokens live here
 * (keeps hex out of components). Keep in sync with `src/styles/tokens.css`.
 */
export const THEME_COLOR = {
  /** Approximates `--color-bg`, dark side. */
  dark: '#040e16',
  /** Approximates `--color-bg`, light side. */
  light: '#f1eadd',
  /** Legacy (non-themed) pages: pinned dark, original look. */
  legacy: '#0a0e17',
} as const;
