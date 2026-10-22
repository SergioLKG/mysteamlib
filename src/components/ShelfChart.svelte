<svelte:options css="injected" />

<script lang="ts">
  import Spine from './Spine.svelte';
  import {
    SHELF_MAX_SPINES,
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
  }

  let { games, markedId, markedLabel, title }: Props = $props();

  const counts = $derived(countStates(games));
  const shelf = $derived(sampleShelf(games, { keepId: markedId }));
  const heights = $derived(spineHeights(shelf));
  const legend = $derived((Object.keys(SPINE_STATE_LABEL) as SpineState[]).filter((s) => counts[s] > 0));
  const cut = $derived(games.length > SHELF_MAX_SPINES);
</script>

<figure class="shelf-chart" aria-label={title}>
  <div class="shelf" aria-hidden="true">
    {#each shelf as game, i (game.id)}
      <Spine state={game.state} height={heights[i]} marked={game.id === markedId} label={markedLabel} />
    {/each}
  </div>

  <ul class="legend">
    {#each legend as state (state)}
      <li>
        <span class="swatch" aria-hidden="true"><Spine {state} height={100} /></span>
        <span class="count">{counts[state].toLocaleString('es-ES')}</span>
        {SPINE_STATE_LABEL[state]}
      </li>
    {/each}
  </ul>

  <figcaption>
    {shelfSummary(counts)}
    {#if cut}Se dibujan los {SHELF_MAX_SPINES} con más horas.{/if}
    Altura = horas jugadas.
  </figcaption>

  <table class="sr-only">
    <caption>{title}</caption>
    <thead><tr><th scope="col">Juego</th><th scope="col">Horas</th><th scope="col">Estado</th></tr></thead>
    <tbody>
      {#each shelf as game (game.id)}
        <tr>
          <th scope="row">{game.name}{game.id === markedId && markedLabel ? ` (${markedLabel})` : ''}</th>
          <td>{game.hours.toLocaleString('es-ES')}</td>
          <td>{SPINE_STATE_LABEL[game.state]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</figure>

<style>
  .shelf-chart {
    display: grid;
    gap: var(--space-3);
    margin: 0;
  }
  .shelf {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    block-size: 8rem;
    padding-block-start: var(--space-3);
    border-block-end: 2px solid var(--color-border-strong);
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
  figcaption {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
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
    border: 0;
  }
  @media (min-width: 900px) {
    .shelf {
      block-size: 12rem;
    }
  }
</style>
