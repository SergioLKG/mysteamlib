<svelte:options css="injected" />

<script lang="ts">
  import Icon from './Icon.svelte';
  import StatFigure from './StatFigure.svelte';
  import TitleChip from './TitleChip.svelte';
  import { genreInk, type UserTitle } from '../lib/ui/genres';
  import { levelBadge } from '../lib/ui/steamLevel';

  interface Props {
    personaName: string;
    avatarUrl: string | null;
    /** Omitted on private profiles (null), never shown as "Sin dato" in an empty ring. */
    steamLevel?: number | null;
    /** ISO date of the Steam account creation; only the year is shown. */
    steamCreatedAt?: string | null;
    gamesCount?: number | null;
    totalHours?: number | null;
    /** Games with no hours at all (the backlog). */
    unplayedCount?: number | null;
    /** Nickname from the most played genre; omitted when the data does not support one. */
    title?: UserTitle | null;
    /** Where "+1 título por descubrir" leads (the sign-in box); without it the link is left out. */
    discoverHref?: string;
    /** The library is still loading: hold the figures' place so the card does not grow when they land. */
    pending?: boolean;
  }

  let {
    personaName,
    avatarUrl,
    steamLevel = null,
    steamCreatedAt = null,
    gamesCount = null,
    totalHours = null,
    unplayedCount = null,
    title = null,
    discoverHref,
    pending = false,
  }: Props = $props();

  const playingSince = $derived(steamCreatedAt ? new Date(steamCreatedAt).getUTCFullYear() : null);
  const badge = $derived(steamLevel === null ? null : levelBadge(steamLevel));
  const unplayedLabel = $derived(
    unplayedCount !== null && gamesCount ? `Sin jugar · ${Math.round((unplayedCount / gamesCount) * 100)} %` : 'Sin jugar',
  );
  // A group with no data is left out of the card instead of showing "Sin dato" (DESIGN.md).
  const stats = $derived(
    [
      { label: 'Juegos', value: gamesCount },
      { label: 'Horas', value: totalHours === null ? null : Math.round(totalHours) },
      { label: unplayedLabel, value: unplayedCount },
    ].filter((s): s is { label: string; value: number } => s.value !== null),
  );
</script>

<!-- "Carné": the profile as a library card. No banner, no decoration (DESIGN.md, Imagery). -->
<div class="card">
  <div class="who">
    {#if avatarUrl}
      <img class="avatar" src={avatarUrl} alt="" width="64" height="64" loading="lazy" />
    {:else}
      <span class="avatar" aria-hidden="true"></span>
    {/if}
    <div class="id">
      <div class="name-row">
        <h2 class="name">{personaName}</h2>
        {#if badge}
          <!-- As on Steam: the number inside a ring coloured by decade; the word "Nivel" keeps it readable without colour. -->
          <span class="level">
            <span class="level-label">Nivel</span>
            <span class={['badge', { long: badge.level >= 100 }]} style:--level-ink={badge.ink}>
              <svg class="ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                {#if badge.shape === 'hexagon'}
                  <polygon points="50,3 91,26.5 91,73.5 50,97 9,73.5 9,26.5" />
                {:else}
                  <circle cx="50" cy="50" r="47" />
                {/if}
              </svg>
              <span class="level-num">{badge.level.toLocaleString('es-ES')}</span>
            </span>
          </span>
        {/if}
      </div>
      {#if playingSince}
        <p class="since"><Icon name="calendar" size={14} />Jugando desde {playingSince}</p>
      {/if}
      {#if title}
        <div class="title-row">
          <TitleChip label={title.label} hint={title.hint} ink={genreInk(title.genre)} />
          {#if discoverHref}<a class="discover" href={discoverHref}>+1 título por descubrir</a>{/if}
        </div>
      {/if}
    </div>
  </div>
  {#if stats.length > 0}
    <div class="stats">
      {#each stats as s (s.label)}
        <StatFigure label={s.label} value={s.value} />
      {/each}
    </div>
  {:else if pending}
    <div class="stats" aria-hidden="true">
      {#each { length: 3 } as _, i (i)}
        <span class="stat-pending"></span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .card {
    /* Anchor of the title tooltip (TitleChip). */
    position: relative;
    display: grid;
    gap: var(--space-5);
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }
  .who {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    min-inline-size: 0;
  }
  .avatar {
    flex: none;
    inline-size: 4rem;
    block-size: 4rem;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    object-fit: cover;
  }
  .id {
    display: grid;
    gap: var(--space-2);
    min-inline-size: 0;
  }
  .name-row,
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-3);
    min-inline-size: 0;
  }
  .name {
    margin: 0;
    overflow-wrap: anywhere;
    color: var(--color-text);
    font-size: var(--text-xl);
    font-weight: var(--weight-bold);
    line-height: var(--leading-snug);
  }
  .level {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
  }
  .badge {
    position: relative;
    display: inline-grid;
    place-items: center;
    inline-size: 2.5rem;
    block-size: 2.5rem;
    color: var(--color-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-bold);
    font-variant-numeric: tabular-nums;
  }
  .badge.long {
    font-size: var(--text-xs);
  }
  .ring {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    fill: none;
    stroke: var(--level-ink);
    overflow: visible;
  }
  /* 2 px at any badge size: a 1 px ring loses its colour (exception to the 1 px rule, DESIGN.md). */
  .ring :is(circle, polygon) {
    stroke-width: 2px;
    vector-effect: non-scaling-stroke;
  }
  .level-num {
    position: relative;
  }
  .since {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-xs);
  }
  .discover {
    display: inline-flex;
    align-items: center;
    color: var(--color-accent-text);
    font-size: var(--text-sm);
    font-weight: var(--weight-semibold);
    text-decoration: none;
  }
  .discover:hover {
    text-decoration: underline;
  }
  .discover:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
    border-radius: var(--radius-sm);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 6rem), 1fr));
    gap: var(--space-4);
  }
  .stat-pending {
    block-size: 3.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }
  /* The three figures stay one block on phones (375 px fits 2 + 1 otherwise); smaller figures make room. */
  @media (max-width: 520px) {
    .stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
    }
    .stats :global(.value) {
      font-size: var(--text-stat-sm);
    }
    /* Touch targets >= 44 px (DESIGN.md). */
    .discover {
      min-block-size: 2.75rem;
    }
  }
  @media (forced-colors: active) {
    .ring {
      stroke: CanvasText;
    }
  }
</style>
