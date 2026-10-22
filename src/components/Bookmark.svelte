<svelte:options css="injected" />

<!-- Ribbon for "mine" or "next platinum" (DESIGN.md, principle 3). Max 3 per screen; it is the
     only glow in the system. Decorative: the marked item names itself in text. The parent
     positions it. -->
<span class="bookmark" aria-hidden="true"></span>

<style>
  .bookmark {
    display: block;
    inline-size: 0.875rem;
    block-size: 1.375rem;
    background: var(--color-accent-mark);
    filter: drop-shadow(var(--glow-bookmark));
    /* Swallow-tail cut at the bottom */
    clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 72%, 0 100%);
  }
</style>
