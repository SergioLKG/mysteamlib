<svelte:options css="injected" />

<script lang="ts">
  import { tick } from "svelte";
  import {
    GENRE_CHIPS_LIMIT,
    LIBRARY_PAGE_SIZE,
    filterPublicLibrary,
    topGenres,
    type PublicLibraryGame,
    type PublicLibrarySort,
    type PublicLibraryState,
  } from "../lib/publicLibrary/view";

  interface Props {
    games: PublicLibraryGame[];
  }

  let { games }: Props = $props();

  const STATES: { value: PublicLibraryState; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "played", label: "Jugados" },
    { value: "unplayed", label: "Sin jugar" },
    { value: "recent", label: "Recientes" },
  ];
  const SORTS: { value: PublicLibrarySort; label: string }[] = [
    { value: "hours", label: "Más horas" },
    // Not "Recientes": the state filter already uses that word.
    { value: "recent", label: "Últimas 2 semanas" },
    { value: "name", label: "Nombre" },
  ];

  let state = $state<PublicLibraryState>("all");
  let sort = $state<PublicLibrarySort>("hours");
  let genre = $state("");
  let query = $state("");
  let shown = $state(LIBRARY_PAGE_SIZE);
  let scroller = $state<HTMLDivElement>();
  let items = $state<HTMLLIElement[]>([]);
  // Hides the bottom inner shadow once there is nothing left to scroll.
  let atEnd = $state(true);

  const genres = $derived(topGenres(games, GENRE_CHIPS_LIMIT));
  const filtered = $derived(
    filterPublicLibrary(games, { genre, state, sort, query }),
  );
  const visible = $derived(filtered.slice(0, shown));

  function measure() {
    if (scroller)
      atEnd =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
  }

  // New content (filters, «Ver más») or a new size changes whether there is more below.
  $effect(() => {
    void visible.length;
    if (!scroller) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild);
    return () => ro.disconnect();
  });

  // A new filter starts again from the first batch, at the top of the box.
  function resetBatch() {
    shown = LIBRARY_PAGE_SIZE;
    if (scroller) scroller.scrollTop = 0;
  }

  async function showMore() {
    const first = shown;
    shown += LIBRARY_PAGE_SIZE;
    // «Ver más» may unmount with the last batch: the focus goes to the first new game.
    await tick();
    items[first]?.focus();
  }

  function formatHours(h: number): string {
    return h === 0
      ? "Sin jugar"
      : `${h < 0.1 ? "<0,1" : h.toLocaleString("es-ES")} h`;
  }
</script>

<section class="library" aria-label="Biblioteca pública">
  <div class="controls">
    <div class="row">
      <input
        class="search"
        type="search"
        autocomplete="off"
        spellcheck="false"
        placeholder="Buscar por nombre"
        aria-label="Buscar por nombre"
        bind:value={query}
        oninput={resetBatch}
      />
      <select
        class="sort"
        aria-label="Ordenar por"
        bind:value={sort}
        onchange={resetBatch}
      >
        {#each SORTS as s (s.value)}
          <option value={s.value}>{s.label}</option>
        {/each}
      </select>
    </div>

    <div class="filters">
      <div class="chips" role="group" aria-label="Estado">
        {#each STATES as s (s.value)}
          <button
            type="button"
            class="chip"
            aria-pressed={state === s.value}
            onclick={() => {
              state = s.value;
              resetBatch();
            }}
          >
            {s.label}
          </button>
        {/each}
      </div>

      {#if genres.length > 0}
        <div class="chips genres" role="group" aria-label="Género">
          {#each genres as g (g)}
            <button
              type="button"
              class="chip"
              aria-pressed={genre === g}
              onclick={() => {
                genre = genre === g ? "" : g;
                resetBatch();
              }}
            >
              {g}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  {#if filtered.length === 0}
    <p class="count" role="status">No encuentro juegos con estos filtros.</p>
  {:else}
    <p class="count">
      Mostrando {visible.length.toLocaleString("es-ES")} de {filtered.length.toLocaleString(
        "es-ES",
      )}
    </p>
  {/if}

  {#if visible.length > 0}
    <!-- Contained list (DESIGN.md): its own scroll, reachable with the keyboard, with «Ver más» at the end. -->
    <div class={["scroll-wrap", { "has-more": !atEnd }]}>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="scroller"
        role="region"
        aria-label="Juegos de la biblioteca"
        tabindex="0"
        bind:this={scroller}
        onscroll={measure}
      >
        <ul class="grid">
          {#each visible as g, i (g.appid)}
            <li class="game" tabindex="-1" bind:this={items[i]}>
              {#if g.headerImageUrl}
                <img
                  class="cover"
                  src={g.headerImageUrl}
                  alt=""
                  width="460"
                  height="215"
                  loading="lazy"
                  decoding="async"
                />
              {:else}
                <div class="cover cover-empty" aria-hidden="true"></div>
              {/if}
              <p class="gname" title={g.name}>{g.name}</p>
              <p class="ghours">{formatHours(g.hours)}</p>
            </li>
          {/each}
        </ul>

        {#if filtered.length > visible.length}
          <button type="button" class="more" onclick={showMore}> Ver más </button>
        {/if}
      </div>
    </div>
  {/if}
</section>

<style>
  .library {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  .controls {
    display: grid;
    gap: var(--space-3);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--space-2);
  }
  .search,
  .sort {
    min-width: 0;
    min-height: 2.75rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border-strong);
    outline: 2px solid transparent;
    outline-offset: 1px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-sm);
  }
  .sort {
    color-scheme: light dark;
    padding-inline-end: var(--space-3);
    cursor: pointer;
  }
  .search:focus-visible,
  .sort:focus-visible {
    outline-color: var(--color-focus);
  }
  .search::placeholder {
    color: var(--color-text-muted);
  }

  /* Mobile: two rows, each with its own scroll; the padding (undone by the margin) keeps the focus ring from being clipped. */
  .filters {
    display: grid;
    gap: var(--space-2);
    min-width: 0;
  }
  .chips {
    display: flex;
    flex: none;
    gap: var(--space-2);
    min-width: 0;
    margin: -4px;
    padding: 4px;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .chip {
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border-strong);
    background: transparent;
    color: var(--color-text-body);
    font: inherit;
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    line-height: 1;
    cursor: pointer;
    text-wrap: nowrap;
    transition:
      background-color var(--duration-base) var(--ease-out),
      border-color var(--duration-base) var(--ease-out);
  }
  .chip:hover {
    border-color: var(--color-text-muted);
  }
  .chip[aria-pressed="true"] {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent-text);
  }
  .chip:focus-visible,
  .more:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }

  .count {
    margin: 0;
    outline: none;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }

  .scroll-wrap {
    position: relative;
  }
  /* Inner shadow at the bottom while there is more to scroll (no glow: DESIGN.md). */
  .scroll-wrap::after {
    content: "";
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: var(--space-6);
    border-end-start-radius: var(--radius-sm);
    border-end-end-radius: var(--radius-sm);
    background: linear-gradient(
      to top,
      color-mix(in oklch, var(--color-bg) 92%, transparent),
      transparent
    );
    pointer-events: none;
    opacity: 0;
    transition: opacity var(--duration-base) var(--ease-out);
  }
  .scroll-wrap.has-more::after {
    opacity: 1;
  }
  /* Below a 667 px phone screen it would be a scroll trap: at most 60 % of the viewport. */
  .scroller {
    display: grid;
    gap: var(--space-4);
    max-block-size: min(500px, 60svh);
    padding: 4px;
    margin: -4px;
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .scroller:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 0;
  }

  /* Two columns even at 320 px: one per row would bury the list. */
  .grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(
      auto-fill,
      minmax(min(10.5rem, calc((100% - var(--space-3)) / 2)), 1fr)
    );
    gap: var(--space-3);
  }
  .game {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
    outline: none;
  }
  .game:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  .cover {
    display: block;
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 460 / 215;
    object-fit: cover;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }
  .gname {
    margin: var(--space-1) 0 0;
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ghours {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .more {
    justify-self: center;
    min-height: 2.75rem;
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border-strong);
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-weight: var(--weight-bold);
    cursor: pointer;
  }
  .more:hover {
    border-color: var(--color-text-muted);
  }

  /* Desktop: one row. States stay big; genres become a thin strip that scrolls in the free space beside them, split from the states by a start border the height of the state chips. */
  @media (min-width: 48rem) {
    .filters {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .filters .chips {
      margin: 0;
      padding: 0;
      overflow: visible;
    }
    .filters .genres {
      flex: 1 1 0;
      align-self: stretch;
      align-items: center;
      min-width: 0;
      padding: 2px var(--space-2) 2px var(--space-3);
      border-inline-start: 1px solid var(--color-border);
      overflow-x: auto;
      scrollbar-width: thin;
    }
    .genres .chip {
      min-height: 1.75rem;
      padding: 0 var(--space-3);
      font-size: var(--text-xs);
    }
    .genres .chip:focus-visible {
      outline-offset: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .scroll-wrap::after {
      transition: none;
    }
  }
</style>
