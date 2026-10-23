<svelte:options css="injected" />

<script lang="ts">
  import StatFigure from './StatFigure.svelte';
  import TitleChip from './TitleChip.svelte';
  import type { UserTitle } from '../lib/ui/genres';

  interface Props {
    personaName: string;
    avatarUrl: string | null;
    /** Omitted on private profiles (null), never shown as "Sin dato" in an empty ring. */
    steamLevel?: number | null;
    /** ISO date of the Steam account creation; only the year is shown. */
    steamCreatedAt?: string | null;
    gamesCount?: number | null;
    totalHours?: number | null;
    /** Nickname from the most played genre; omitted when the data does not support one. */
    title?: UserTitle | null;
  }

  let {
    personaName,
    avatarUrl,
    steamLevel = null,
    steamCreatedAt = null,
    gamesCount = null,
    totalHours = null,
    title = null,
  }: Props = $props();

  const memberSince = $derived(steamCreatedAt ? new Date(steamCreatedAt).getUTCFullYear() : null);
  // A group with no data is left out of the card instead of showing "Sin dato" (DESIGN.md).
  const stats = $derived(
    [
      { label: 'Nivel de Steam', value: steamLevel },
      { label: 'Socio desde', value: memberSince },
      { label: 'Juegos', value: gamesCount },
      { label: 'Horas', value: totalHours === null ? null : Math.round(totalHours) },
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
      <p class="name">{personaName}</p>
      {#if title}<TitleChip label={title.label} hint={title.hint} />{/if}
    </div>
  </div>
  {#if stats.length > 0}
    <div class="stats">
      {#each stats as s (s.label)}
        <StatFigure small label={s.label} value={s.value} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .card {
    /* Anchor of the title tooltip (TitleChip). */
    position: relative;
    display: grid;
    gap: var(--space-4);
    padding: var(--space-4);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    box-shadow: var(--shadow-card);
  }
  .who {
    display: flex;
    align-items: center;
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
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr));
    gap: var(--space-4);
  }
</style>
