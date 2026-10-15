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
    oninput?: (lo: number, hi: number) => void;
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
    oninput = () => {},
  }: Props = $props();

  // Both inputs span the full min–max range so each thumb stays aligned with
  // the track; the thumbs are kept from crossing by clamping here.
  // The input is written back because a clamped value leaves `lo`/`hi` unchanged,
  // so Svelte would not re-sync the dragged thumb on its own.
  function setLo(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const next = Math.min(Number(input.value), hi);
    input.value = String(next);
    oninput(next, hi);
  }

  function setHi(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    const next = Math.max(Number(input.value), lo);
    input.value = String(next);
    oninput(lo, next);
  }

  const span = $derived(Math.max(1, max - min));
  const pctLo = $derived(((lo - min) / span) * 100);
  const pctHi = $derived(((hi - min) / span) * 100);
  const valueText = $derived(
    lo === min && hi === max ? 'Cualquiera' : `${lo} – ${hi}`,
  );
  // When both thumbs sit near max, the low one goes on top so it can be dragged back.
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
    {max}
    {step}
    value={lo}
    style:z-index={pctLo > 50 ? 4 : undefined}
    aria-label={loLabel || `${label}, mínimo`}
    oninput={setLo}
  />
  <input
    class="range range-hi"
    type="range"
    {min}
    {max}
    {step}
    value={hi}
    aria-label={hiLabel || `${label}, máximo`}
    oninput={setHi}
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
    background: linear-gradient(90deg, var(--accent, var(--color-accent)), var(--accent-2, var(--color-accent-hover)));
  }

  .range {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 20px;
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

  .range::-webkit-slider-runnable-track {
    -webkit-appearance: none;
    height: 6px;
    background: transparent;
  }
  .range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: 16px;
    height: 16px;
    margin-top: -5px;
    border-radius: 50%;
    background: #eef1ff;
    border: 3px solid var(--accent, var(--color-accent));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    cursor: grab;
  }
  .range::-moz-range-track {
    height: 6px;
    background: transparent;
  }
  .range::-moz-range-thumb {
    pointer-events: auto;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #eef1ff;
    border: 3px solid var(--accent, var(--color-accent));
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