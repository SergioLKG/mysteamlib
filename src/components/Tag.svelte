<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<!-- "Tejuelo": small outlined label, no icon (DESIGN.md, Motifs). -->
<span class="tag">{@render children()}</span>

<style>
  .tag {
    display: inline-block;
    padding: 0.125rem var(--space-2);
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);
    color: var(--color-text-body);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    line-height: 1.4;
    white-space: nowrap;
  }
</style>
