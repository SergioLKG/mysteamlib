<script lang="ts">
  import Icon from './Icon.svelte';

  let scrolledPastScreen = $state(false);
  let footerInView = $state(false);
  let innerHeight = $state(0);

  // Hidden while the footer is on screen so it never covers the legal links.
  const visible = $derived(scrolledPastScreen && !footerInView);

  $effect(() => {
    // A restored scroll position or an anchor load fires no scroll event.
    scrolledPastScreen = window.scrollY > window.innerHeight;
    const footer = document.querySelector('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => {
      footerInView = entry.isIntersecting;
    });
    observer.observe(footer);
    return () => observer.disconnect();
  });

  function toTop() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    // The button hides itself: hand the keyboard focus to the page, not to <body>.
    const main = document.getElementById('main-content');
    main?.setAttribute('tabindex', '-1');
    main?.focus({ preventScroll: true });
  }
</script>

<svelte:window
  bind:innerHeight
  onscroll={() => (scrolledPastScreen = window.scrollY > innerHeight)}
/>

<button
  type="button"
  class="top"
  class:visible
  aria-label="Volver arriba"
  onclick={toTop}
>
  <Icon name="arrow-up" size={22} />
</button>

<style>
  .top {
    position: fixed;
    inset-inline-end: max(var(--space-gutter), env(safe-area-inset-right));
    inset-block-end: max(var(--space-4), env(safe-area-inset-bottom));
    z-index: 10;
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    padding: 0;
    border: 1px solid var(--color-border-strong);
    border-radius: var(--radius-pill);
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-pop);
    cursor: pointer;
    opacity: 0;
    visibility: hidden;
    transform: translateY(0.5rem);
    transition:
      opacity var(--duration-base) var(--ease-out),
      transform var(--duration-base) var(--ease-out),
      visibility var(--duration-base),
      border-color var(--duration-base) var(--ease-out);
  }
  .top.visible {
    opacity: 1;
    visibility: visible;
    transform: none;
  }
  .top:hover {
    border-color: var(--color-accent);
    color: var(--color-accent-text);
  }
  .top:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .top {
      transform: none;
      transition: none;
    }
  }
</style>
