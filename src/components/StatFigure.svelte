<svelte:options css="injected" />

<script lang="ts">
  interface Props {
    /** `null` = unknown, rendered as "Sin dato" (rule 7). */
    value: number | string | null;
    label: string;
    /** Smaller figure for use inside cards. */
    small?: boolean;
  }

  let { value, label, small = false }: Props = $props();
  const text = $derived(typeof value === 'number' ? value.toLocaleString('es-ES') : (value ?? 'Sin dato'));
</script>

<!-- The figure leads; the label sits below in muted (DESIGN.md, principle 6). -->
<div class="stat" class:small>
  <span class="value" class:unknown={value === null}>{text}</span>
  <span class="label">{label}</span>
</div>

<style>
  .stat {
    display: grid;
    gap: var(--space-1);
    min-inline-size: 0;
  }
  .value {
    color: var(--color-text);
    font-size: var(--text-stat);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-stat);
    line-height: 1;
  }
  .small .value {
    font-size: var(--text-stat-sm);
  }
  .value.unknown {
    color: var(--color-text-muted);
    font-size: var(--text-base);
    font-weight: var(--weight-semibold);
    letter-spacing: 0;
  }
  .label {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
</style>
