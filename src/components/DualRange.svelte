<script lang="ts">
  interface Props {
    label: string;
    lo: number;
    hi: number;
    min?: number;
    max?: number;
    step?: number;
    loLabel?: string;
    hiLabel?: string;
    onchange?: (lo: number, hi: number) => void;
  }

  let {
    label,
    lo,
    hi,
    min = 0,
    max = 100,
    step = 1,
    loLabel = '',
    hiLabel = '',
    onchange = () => {},
  }: Props = $props();

  function setLo(e: Event): void {
    onchange(Number((e.currentTarget as HTMLInputElement).value), hi);
  }

  function setHi(e: Event): void {
    onchange(lo, Number((e.currentTarget as HTMLInputElement).value));
  }

  const span = $derived(Math.max(1, max - min));
  const pctLo = $derived(((lo - min) / span) * 100);
  const pctHi = $derived(((hi - min) / span) * 100);
  const valueText = $derived(
    lo === min && hi === max ? 'Cualquiera' : `${lo} – ${hi}`,
  );

  // Keep the two thumbs from crossing: the low input is capped at the current
  // high value and vice versa, so min/max can never invert.
</script>

<div class="dual-range">
  <div class="dual-head">
    <span class="dual-label">{label}</span>
    <span class="dual-value" aria-live="polite">{valueText}</span>
  </div>

  <div class="dual-track" aria-hidden="true">
    <div class="dual-track-fill" style:left="{pctLo}%" style:width="{pctHi - pctLo}%"></div>
  </div>

  <input
    class="range range-lo"
    type="range"
    {min}
    max={hi}
    {step}
    value={lo}
    aria-label={loLabel || `${label}, mínimo`}
    onchange={setLo}
  />
  <input
    class="range range-hi"
    type="range"
    min={lo}
    {max}
    {step}
    value={hi}
    aria-label={hiLabel || `${label}, máximo`}
    onchange={setHi}
  />
</div>

<style>
  .dual-range {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    width: 100%;
  }
  .dual-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .dual-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }
  .dual-value {
    font-size: 0.82rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text, #f1f5f9);
  }

  .dual-track {
    position: relative;
    height: 20px;
    touch-action: none;
  }
  .dual-track::before {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 7px;
    height: 6px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text, #f1f5f9) 14%, transparent);
  }
  .dual-track-fill {
    position: absolute;
    top: 7px;
    height: 6px;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent, #7c8dff), var(--accent-2, #b06ab3));
  }

  .range {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    pointer-events: none;
  }
  .range-lo {
    z-index: 2;
  }
  .range-hi {
    z-index: 3;
  }

  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #eef1ff;
    border: 3px solid var(--accent, #7c8dff);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: grab;
  }
  .range::-moz-range-thumb {
    pointer-events: auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #eef1ff;
    border: 3px solid var(--accent, #7c8dff);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: grab;
  }
  .range:active::-webkit-slider-thumb {
    cursor: grabbing;
  }
  .range:focus-visible::-webkit-slider-thumb {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .range:focus-visible::-moz-range-thumb {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
</style>