<svelte:options css="injected" />

<script lang="ts">
  import { MARK_LABEL_MIN_HEIGHT, type SpineState } from '../lib/ui/shelf';
  import Bookmark from './Bookmark.svelte';

  interface Props {
    state: SpineState;
    /** Height in % of the shelf (see `spineHeights`). */
    height: number;
    /** Bookmarked spine: raised, blue, with ribbon. The only one allowed to use blue. */
    marked?: boolean;
    /** Vertical label, only shown on the marked spine and only if it is tall enough to hold it. */
    label?: string;
  }

  let { state, height, marked = false, label }: Props = $props();
</script>

<!-- Decorative: the figcaption and the equivalent table of the chart carry the data. -->
<span class={['spine', state, { marked }]} style:--h={height} aria-hidden="true">
  {#if marked}
    <span class="ribbon"><Bookmark /></span>
    {#if label && height >= MARK_LABEL_MIN_HEIGHT}<span class="label">{label}</span>{/if}
  {/if}
</span>

<style>
  .spine {
    position: relative;
    display: block;
    flex: 1 1 0;
    min-inline-size: 0;
    block-size: calc(var(--h) * 1%);
    border: 1px solid var(--color-spine-empty);
    border-block-end: 0;
    border-start-start-radius: var(--radius-sm);
    border-start-end-radius: var(--radius-sm);
    /* Fills stay off the border box so the 1 px outline reads in every state. */
    background-clip: padding-box;
  }
  .empty {
    background: transparent;
  }
  .started {
    border-color: var(--color-spine-played);
    background: var(--pattern-started);
    background-clip: padding-box;
  }
  .played {
    border-color: var(--color-spine-played);
    background: var(--color-spine-played);
  }
  .done {
    border-color: var(--color-spine-done);
    background: var(--color-spine-done);
  }
  .marked {
    border-color: var(--color-accent-mark);
    background: var(--color-accent-mark);
    transform: translateY(calc(var(--space-2) * -1));
    box-shadow: var(--glow-bookmark);
  }
  .ribbon {
    position: absolute;
    inset-block-start: 0;
    inset-inline-start: 50%;
    translate: -50% 0;
  }
  .label {
    position: absolute;
    inset-block-end: var(--space-2);
    inset-inline-start: 50%;
    translate: -50% 0;
    writing-mode: vertical-rl;
    rotate: 180deg;
    color: var(--color-on-accent);
    font-size: var(--text-xs);
    font-weight: var(--weight-bold);
    white-space: nowrap;
  }
</style>
