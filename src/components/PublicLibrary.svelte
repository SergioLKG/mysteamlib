<script lang="ts">
  import { tick } from 'svelte';
  import {
    GENRE_CHIPS_LIMIT,
    LIBRARY_PAGE_SIZE,
    filterPublicLibrary,
    topGenres,
    type PublicLibraryGame,
    type PublicLibrarySort,
    type PublicLibraryState,
  } from '../lib/publicLibrary/view';

  interface Props {
    gamesCount: number;
    totalHours: number;
    games: PublicLibraryGame[];
  }

  let { gamesCount, totalHours, games }: Props = $props();

  const STATES: { value: PublicLibraryState; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'played', label: 'Jugados' },
    { value: 'unplayed', label: 'Sin jugar' },
    { value: 'recent', label: 'Recientes' },
  ];
  const SORTS: { value: PublicLibrarySort; label: string }[] = [
    { value: 'hours', label: 'Más horas' },
    { value: 'recent', label: 'Recientes' },
    { value: 'name', label: 'Nombre' },
  ];

  let state = $state<PublicLibraryState>('all');
  let sort = $state<PublicLibrarySort>('hours');
  let genre = $state('');
  let query = $state('');
  let shown = $state(LIBRARY_PAGE_SIZE);
  let countEl = $state<HTMLParagraphElement>();

  const genres = $derived(topGenres(games, GENRE_CHIPS_LIMIT));
  const filtered = $derived(filterPublicLibrary(games, { genre, state, sort, query }));
  const visible = $derived(filtered.slice(0, shown));

  // A new filter starts again from the first batch.
  function resetBatch() {
    shown = LIBRARY_PAGE_SIZE;
  }

  async function showMore() {
    shown += LIBRARY_PAGE_SIZE;
    // «Ver más» unmounts with the last batch: keep the keyboard focus in the list.
    if (shown >= filtered.length) {
      await tick();
      countEl?.focus();
    }
  }

  function formatHours(h: number): string {
    return h === 0 ? 'Sin jugar' : `${h < 0.1 ? '<0,1' : h.toLocaleString('es-ES')} h`;
  }
</script>

<section class="library" aria-label="Biblioteca pública">
  <p class="summary">
    <strong>{gamesCount.toLocaleString('es-ES')}</strong> juegos ·
    <strong>{totalHours.toLocaleString('es-ES')}</strong> h jugadas
  </p>

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
      <select class="sort" aria-label="Ordenar por" bind:value={sort} onchange={resetBatch}>
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
                genre = genre === g ? '' : g;
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
    <p class="count" tabindex="-1" bind:this={countEl}>
      Mostrando {visible.length.toLocaleString('es-ES')} de {filtered.length.toLocaleString('es-ES')}
    </p>
  {/if}

  {#if visible.length > 0}
    <ul class="grid">
      {#each visible as g (g.appid)}
        <li class="game">
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
  {/if}

  {#if filtered.length > visible.length}
    <button type="button" class="more" onclick={showMore}>
      Ver más
    </button>
  {/if}
</section>

<style>
  .library {
    display: grid;
    gap: var(--space-4);
    min-width: 0;
  }
  .summary {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-muted);
  }
  .summary strong {
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
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

  /* One scrolling row on mobile; the padding (undone by the margin) keeps the focus ring from being clipped. */
  .filters {
    display: flex;
    gap: var(--space-4);
    margin: -4px;
    padding: 4px;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .chips {
    display: flex;
    flex: none;
    gap: var(--space-2);
  }
  .chips + .chips {
    padding-inline-start: var(--space-4);
    border-inline-start: 1px solid var(--color-border);
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
    transition:
      background-color var(--duration-base) var(--ease-out),
      border-color var(--duration-base) var(--ease-out);
  }
  .chip:hover {
    border-color: var(--color-text-muted);
  }
  .chip[aria-pressed='true'] {
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

  .grid {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
    gap: var(--space-3);
  }
  .game {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
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

  /* Desktop: states stay big; genres become a thin, bordered strip that scrolls in the free space beside them. */
  @media (min-width: 48rem) {
    .filters {
      align-items: center;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      overflow: visible;
    }
    .filters .genres {
      flex: 1 1 0;
      min-width: 0;
      padding: 2px var(--space-2);
      border-block: 1px solid var(--color-border);
      border-inline-start: 0;
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
    .chip {
      transition: none;
    }
  }
</style>
