<svelte:options css="injected" />

<script lang="ts">
  import { MediaQuery } from 'svelte/reactivity';
  import Spine from './Spine.svelte';
  import { NEUTRAL_INK, gameInk, genreInk, type GenreStats } from '../lib/ui/genres';
  import {
    SHELF_MAX_SPINES,
    SHELF_MAX_SPINES_NARROW,
    SPINE_STATE_LABEL,
    countStates,
    sampleShelf,
    shelfSummary,
    spineHeights,
    type ShelfGame,
    type SpineState,
  } from '../lib/ui/shelf';

  interface Props {
    games: ShelfGame[];
    /** Bookmarked game ("Mi próximo platino"); always drawn. */
    markedId?: ShelfGame['id'];
    markedLabel?: string;
    /** Accessible name of the figure. */
    title: string;
    /** Hours per genre of the whole library; without it the genre legend is left out. */
    genres?: GenreStats;
  }

  /** Genres listed under the shelf. */
  const LEGEND_GENRES = 5;
  /** Sum of shares can pass 100 % (a game counts in each of its genres); hide the gap note above this coverage. */
  const COVERAGE_NOTE_BELOW = 0.95;

  let { games, markedId, markedLabel, title, genres }: Props = $props();

  // Same breakpoint as the lookup's mobile layout.
  const narrow = new MediaQuery('max-width: 520px');
  const max = $derived(narrow.current ? SHELF_MAX_SPINES_NARROW : SHELF_MAX_SPINES);

  // The summary counts the whole library; the key only names the states that are actually drawn.
  const counts = $derived(countStates(games));
  const shelf = $derived(sampleShelf(games, { max, keepId: markedId }));
  const heights = $derived(spineHeights(shelf));
  // Neutral games keep the plain state colours instead of the darker "played" ink.
  const inks = $derived(
    shelf.map((g) => {
      const ink = gameInk(g.genres);
      return ink === NEUTRAL_INK ? undefined : ink;
    }),
  );
  const drawn = $derived(countStates(shelf));
  const legend = $derived((Object.keys(SPINE_STATE_LABEL) as SpineState[]).filter((s) => drawn[s] > 0));
  const cut = $derived(games.length > max);
  const topGenres = $derived(genres?.genres.slice(0, LEGEND_GENRES) ?? []);

  const hoursFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  const percentFmt = new Intl.NumberFormat('es-ES', { style: 'percent', maximumFractionDigits: 0 });

  let shelfEl = $state<HTMLDivElement>();
  let buttons = $state<HTMLButtonElement[]>([]);
  // Spine shown in the tooltip (hover, touch or focus) and the one reachable with Tab.
  let active = $state<number | null>(null);
  let tabStop = $state(0);
  // A new shelf (other games or bookmark) must not leave a stale index: no tab stop would be reachable.
  const stop = $derived(Math.min(tabStop, Math.max(0, shelf.length - 1)));
  $effect(() => {
    void shelf;
    active = null;
  });

  const current = $derived(active === null ? null : (shelf[active] ?? null));
  const tipX = $derived.by(() => {
    const el = active === null ? undefined : buttons[active];
    return el ? el.offsetLeft + el.offsetWidth / 2 : 0;
  });

  function label(game: ShelfGame): string {
    const parts = [game.name, `${hoursFmt.format(game.hours)} h`, SPINE_STATE_LABEL[game.state]];
    if (game.genres?.length) parts.push(game.genres.join(', '));
    if (game.id === markedId && markedLabel) parts.push(markedLabel);
    return parts.join(', ');
  }

  // Spines share one width, so the pointer's X is enough: it also covers the gaps, short
  // spines and a finger dragged across the shelf.
  function pointAt(e: PointerEvent) {
    if (!shelfEl || shelf.length === 0) return;
    const rect = shelfEl.getBoundingClientRect();
    const i = Math.floor(((e.clientX - rect.left) / rect.width) * shelf.length);
    active = Math.min(shelf.length - 1, Math.max(0, i));
  }

  function leave(e: PointerEvent) {
    // A finger lifted off keeps the tooltip readable until the next touch elsewhere.
    if (e.pointerType === 'mouse' && !shelfEl?.contains(document.activeElement)) active = null;
  }

  function outside(e: PointerEvent) {
    if (shelfEl && !shelfEl.contains(e.target as Node)) active = null;
  }

  function focusOut(e: FocusEvent) {
    if (!shelfEl?.contains(e.relatedTarget as Node | null)) active = null;
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      active = null;
      return;
    }
    const last = shelf.length - 1;
    const from = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const to =
      e.key === 'ArrowRight' ? from + 1 : e.key === 'ArrowLeft' ? from - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? last : null;
    if (to === null) return;
    e.preventDefault();
    buttons[Math.min(last, Math.max(0, to))]?.focus();
  }
</script>

<svelte:window onpointerdown={outside} />

<figure class="shelf-chart" aria-label={title}>
  <!-- First, so a screen reader hears the summary before the spines; sighted users get the key below. -->
  <figcaption class="sr-only">
    {shelfSummary(counts)}
    {#if cut}Se dibujan los {max} con más horas.{/if}
    Altura = horas jugadas. Recórrela con el cursor, el dedo o las flechas para ver cada juego.
  </figcaption>
  <div class="stage">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="shelf"
      role="group"
      aria-label="Juegos de más a menos horas"
      bind:this={shelfEl}
      onpointermove={pointAt}
      onpointerdown={pointAt}
      onpointerleave={leave}
      onfocusout={focusOut}
      onkeydown={keydown}
    >
      {#each shelf as game, i (game.id)}
        <button
          type="button"
          class="hit"
          aria-label={label(game)}
          tabindex={i === stop ? 0 : -1}
          bind:this={buttons[i]}
          onfocus={() => {
            tabStop = i;
            active = i;
          }}
        >
          <Spine
            state={game.state}
            height={heights[i]}
            marked={game.id === markedId}
            label={markedLabel}
            ink={inks[i]}
            active={active === null ? i === 0 : active === i}
          />
        </button>
      {/each}
    </div>

    {#if current}
      <div class="tip" style:--cx="{tipX}px" aria-hidden="true">
        {#if current.image}
          <img class="cover" src={current.image} alt="" width="460" height="215" loading="lazy" />
        {/if}
        <p class="tip-name">{current.name}</p>
        <p class="tip-hours">
          <strong>{hoursFmt.format(current.hours)} h</strong>
          {#if current.recentHours}· {hoursFmt.format(current.recentHours)} h en las últimas 2 semanas{/if}
        </p>
        <p class="tip-state">{SPINE_STATE_LABEL[current.state]}</p>
        {#if current.genres?.length}
          <ul class="tip-genres">
            {#each current.genres as genre (genre)}
              <li><span class="dot" style:--dot={genreInk(genre)}></span>{genre}</li>
            {/each}
          </ul>
        {:else}
          <p class="tip-state">Sin géneros</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Key of the drawn states only (outline vs fill); the counts live in the card. -->
  <ul class="key" aria-hidden="true">
    {#each legend as state (state)}
      <li>
        <span class="swatch"><Spine {state} height={100} /></span>
        {SPINE_STATE_LABEL[state]}
      </li>
    {/each}
    {#if cut}<li>Altura = horas · los {max} con más horas</li>{/if}
  </ul>

  {#if topGenres.length > 0 && genres}
    <div class="genres">
      <p class="genres-title">Géneros con más horas</p>
      <ul class="legend">
        {#each topGenres as g (g.genre)}
          <li>
            <span class="dot" style:--dot={genreInk(g.genre)} aria-hidden="true"></span>
            <span class="count">{percentFmt.format(g.share)}</span>
            {g.genre}
            <span class="muted">· {g.games.toLocaleString('es-ES')} {g.games === 1 ? 'juego' : 'juegos'}</span>
          </li>
        {/each}
      </ul>
      <p class="note">
        Un juego cuenta en todos sus géneros, así que los porcentajes pueden sumar más de 100 %.
        {#if genres.coverage < COVERAGE_NOTE_BELOW}
          Falta el género en juegos que suman el {percentFmt.format(1 - genres.coverage)} de las horas.
        {/if}
      </p>
    </div>
  {/if}

</figure>

<style>
  .shelf-chart {
    display: grid;
    gap: var(--space-3);
    margin: 0;
  }
  .stage {
    position: relative;
  }
  .shelf {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    block-size: 8rem;
    padding-block-start: var(--space-3);
    border-block-end: 2px solid var(--color-border-strong);
    /* Horizontal drags move the tooltip; vertical ones still scroll the page. */
    touch-action: pan-y;
  }
  /* Each column is the hit area, so a short spine is as easy to reach as a tall one. */
  .hit {
    display: flex;
    flex: 1 1 0;
    align-items: flex-end;
    align-self: stretch;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: default;
  }
  .hit:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 1px;
  }
  .tip {
    --tw: min(17rem, 100%);
    position: absolute;
    z-index: 2;
    inset-block-end: calc(100% + var(--space-2));
    inline-size: var(--tw);
    /* Centred on the spine, then kept inside the figure. */
    inset-inline-start: clamp(calc(var(--tw) / 2), var(--cx), calc(100% - var(--tw) / 2));
    translate: -50% 0;
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    box-shadow: var(--shadow-pop);
    pointer-events: none;
  }
  .cover {
    inline-size: 100%;
    block-size: auto;
    aspect-ratio: 460 / 215;
    margin-block-end: var(--space-1);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    object-fit: cover;
  }
  .tip p {
    margin: 0;
  }
  .tip-name {
    color: var(--color-text);
    font-weight: var(--weight-bold);
    overflow-wrap: anywhere;
  }
  .tip-hours,
  .tip-state {
    color: var(--color-text-body);
    font-size: var(--text-sm);
  }
  .tip-hours strong {
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
  }
  .tip-genres {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-text-body);
    font-size: var(--text-xs);
  }
  .tip-genres li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .dot {
    flex: none;
    inline-size: 0.625rem;
    block-size: 0.625rem;
    border-radius: var(--radius-pill);
    background: var(--dot);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-text-body);
    font-size: var(--text-sm);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .swatch {
    display: flex;
    align-items: flex-end;
    inline-size: 0.75rem;
    block-size: 1rem;
  }
  .count {
    color: var(--color-text);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--color-text-muted);
  }
  .genres {
    display: grid;
    gap: var(--space-2);
  }
  .genres-title {
    margin: 0;
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
  }
  .key {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }
  .key li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .note {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
    font-style: italic;
  }
  .sr-only {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  /* Mobile: a compact tooltip (no cover) so it hides less of the card while dragging. */
  @media (max-width: 520px) {
    .cover {
      display: none;
    }
  }
  @media (min-width: 900px) {
    .shelf {
      block-size: 12rem;
    }
  }
  @media (forced-colors: active) {
    .dot {
      forced-color-adjust: none;
      border: 1px solid CanvasText;
    }
  }
</style>
