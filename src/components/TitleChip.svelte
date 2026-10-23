<svelte:options css="injected" />

<script lang="ts">
  import Icon from './Icon.svelte';

  interface Props {
    label: string;
    /** Why the person has this title; shown on hover, focus and tap. */
    hint: string;
    /** Ink of the title's genre (`genreInk`): text and border. Measured >= 4.6:1, so it is legible as text. */
    ink?: string;
  }

  let { label, hint, ink }: Props = $props();

  const id = $props.id();
  let open = $state(false);
</script>

<svelte:window onpointerdown={(e) => { if (!(e.target as Element | null)?.closest?.(`[data-chip="${id}"]`)) open = false; }} />

<!-- Title next to the name: an information chip (text, never colour alone) with a tooltip. -->
<span
  class="chip-wrap"
  data-chip={id}
  onpointerenter={(e) => { if (e.pointerType === 'mouse') open = true; }}
  onpointerleave={(e) => { if (e.pointerType === 'mouse') open = false; }}
>
  <button
    type="button"
    class="chip"
    style:--chip-ink={ink}
    aria-describedby={id}
    onclick={() => (open = true)}
    onfocus={() => (open = true)}
    onblur={() => (open = false)}
    onkeydown={(e) => { if (e.key === 'Escape') open = false; }}
  >
    {label}
    <!-- Hints that there is more behind the chip (the tooltip with the why). -->
    <Icon name="info" size={14} />
  </button>
  <span {id} role="tooltip" class={['tip', { open }]}>{hint}</span>
</span>

<style>
  /* Not positioned on purpose: the tooltip anchors to the nearest positioned ancestor (the card),
     so it spans the card instead of overflowing at 320 px when the chip wraps under the name. */
  .chip-wrap {
    display: inline-flex;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--chip-ink, var(--color-border-strong));
    border-radius: var(--radius-pill);
    background: var(--color-surface-2);
    color: var(--chip-ink, var(--color-text-body));
    font: inherit;
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    white-space: nowrap;
    cursor: help;
  }
  @media (max-width: 520px) {
    .chip {
      min-block-size: 2.75rem;
    }
  }
  .chip:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  .tip {
    position: absolute;
    z-index: 2;
    inset-block-start: calc(100% + var(--space-2));
    inset-inline: var(--space-4);
    max-inline-size: 22rem;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-pop);
    color: var(--color-text-body);
    font-size: var(--text-sm);
    font-weight: var(--weight-regular);
    visibility: hidden;
    opacity: 0;
    transition:
      opacity var(--duration-fast) var(--ease-out),
      visibility var(--duration-fast);
  }
  .tip.open {
    visibility: visible;
    opacity: 1;
  }
</style>
