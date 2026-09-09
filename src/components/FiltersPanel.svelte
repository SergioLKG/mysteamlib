<script lang="ts">
  import DualRange from './DualRange.svelte';

  interface Filters {
    search: string;
    progress: string;
    showCompleted: boolean;
    achievementsMin: number;
    achievementsMax: number;
    timeMin: number;
    timeMax: number;
    includeNoTime: boolean;
    genre: string;
    sort: string;
    direction: string;
  }

  const ACH_MAX = 150;
  const TIME_MAX = 500;

  // `filters` is the reactive $state object owned by LibraryExplorer; controls
  // mutate its fields in place so the parent's derived view updates instantly.
  // `idPrefix` keeps ids unique when the panel is rendered twice (sidebar +
  // mobile modal) on the same page.
  let {
    filters,
    availableGenres = [],
    activeCount = 0,
    direction = 'asc',
    onreset,
    onToggleDirection,
    idPrefix = 'filters',
  }: {
    filters: Filters;
    availableGenres?: string[];
    activeCount?: number;
    direction?: string;
    onreset?: () => void;
    onToggleDirection?: () => void;
    idPrefix?: string;
  } = $props();

  // The label above each select is a real heading for the group's controls.
</script>

<div class="filters-panel" role="group" aria-label="Filtros y ordenación">
  <div class="panel-head">
    <span class="panel-title">Filtros</span>
    <button
      class="dir-toggle"
      type="button"
      onclick={onToggleDirection}
      title="Cambiar dirección del orden"
      aria-label={`Cambiar dirección del orden — actualmente ${direction === 'asc' ? 'ascendente' : 'descendente'}`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="m3 8 4-4 4 4" />
        <path d="M7 4v16" />
        <path d="m21 16-4 4-4-4" />
        <path d="M17 20V4" />
      </svg>
      <span class="dir-label">{direction === 'asc' ? 'Asc' : 'Desc'}</span>
    </button>
  </div>

  <div class="field">
    <label for={`${idPrefix}-search`} class="sr-only">Buscar por nombre</label>
    <input
      id={`${idPrefix}-search`}
      type="search"
      name="search"
      placeholder="Buscar juego…"
      autocomplete="off"
      spellcheck={false}
      bind:value={filters.search}
    />
  </div>

  <div class="field">
    <label for={`${idPrefix}-progress`}>Progreso</label>
    <select id={`${idPrefix}-progress`} name="state" bind:value={filters.progress}>
      <option value="all">Todos</option>
      <option value="unplayed">Sin jugar</option>
      <option value="started">Empezados</option>
      <option value="completed">Completados</option>
    </select>
  </div>

  <div class="field">
    <label for={`${idPrefix}-genre`}>Género</label>
    <select id={`${idPrefix}-genre`} name="genre" bind:value={filters.genre}>
      <option value="">Todos</option>
      {#each availableGenres as g (g)}
        <option value={g}>{g}</option>
      {/each}
    </select>
  </div>

  <div class="field">
    <label for={`${idPrefix}-sort`}>Ordenar</label>
    <select id={`${idPrefix}-sort`} name="sort" bind:value={filters.sort}>
      <option value="difficulty">Recomendado</option>
      <option value="remaining">Logros restantes</option>
      <option value="time">Tiempo estimado</option>
      <option value="rarity">Rareza de logros</option>
    </select>
  </div>

  <div class="range-group">
    <DualRange
      label="Logros restantes"
      min={0}
      max={ACH_MAX}
      step={1}
      lo={filters.achievementsMin}
      hi={filters.achievementsMax}
      loLabel="Logros restantes, mínimo"
      hiLabel="Logros restantes, máximo"
      oninput={(lo, hi) => {
        filters.achievementsMin = lo;
        filters.achievementsMax = hi;
      }}
    />
  </div>

  <div class="range-group">
    <DualRange
      label="Tiempo estimado (h)"
      min={0}
      max={TIME_MAX}
      step={5}
      lo={filters.timeMin}
      hi={filters.timeMax}
      loLabel="Tiempo estimado, mínimo de horas"
      hiLabel="Tiempo estimado, máximo de horas"
      oninput={(lo, hi) => {
        filters.timeMin = lo;
        filters.timeMax = hi;
      }}
    />
  </div>

  <div class="checks">
    <label class="check" for={`${idPrefix}-notime`}>
      <input id={`${idPrefix}-notime`} type="checkbox" bind:checked={filters.includeNoTime} />
      <span>Incluir juegos sin dato de tiempo</span>
    </label>
    <label class="check" for={`${idPrefix}-completed`}>
      <input id={`${idPrefix}-completed`} type="checkbox" bind:checked={filters.showCompleted} />
      <span>Ver platinados (100&nbsp;%)</span>
    </label>
  </div>

  <button class="btn reset" type="button" onclick={onreset} disabled={activeCount === 0}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
    Limpiar filtros
  </button>
</div>

<style>
  .filters-panel {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 0.95rem 1rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.18));
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface, #0f1420) 88%, transparent);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .panel-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-bottom: 0.2rem;
    border-bottom: 1px solid var(--border, rgba(148, 163, 184, 0.14));
  }
  .panel-title {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }

  .dir-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    background: color-mix(in srgb, var(--surface, #0f1420) 70%, #000);
    color: var(--text, #f1f5f9);
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
  }
  .dir-toggle:hover {
    border-color: var(--accent, #7c8dff);
  }
  .dir-label {
    font-variant-numeric: tabular-nums;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.28rem;
    width: 100%;
  }
  .field label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }

  input[type='search'],
  select {
    width: 100%;
    font: inherit;
    font-size: 0.875rem;
    color: inherit;
    padding: 0.45rem 0.6rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 9px;
    background: color-mix(in srgb, var(--surface, #0f1420) 60%, #000);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  input[type='search']:focus-visible,
  select:focus-visible {
    outline: none;
    border-color: var(--accent, #7c8dff);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #7c8dff) 25%, transparent);
  }

  .range-group {
    padding: 0.15rem 0;
  }

  .checks {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.1rem 0;
  }
  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.86rem;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    line-height: 1.3;
  }
  .check input {
    accent-color: var(--accent, #7c8dff);
    flex: none;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    width: 100%;
    padding: 0.55rem 0.8rem;
    font: inherit;
    font-weight: 600;
    font-size: 0.875rem;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
  }
  .reset {
    color: var(--text, #f1f5f9);
    background: color-mix(in srgb, var(--surface, #0f1420) 60%, #000);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.28));
  }
  .reset:not(:disabled):hover {
    border-color: var(--accent, #7c8dff);
    background: color-mix(in srgb, var(--accent, #7c8dff) 12%, transparent);
  }
  .reset:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .dir-toggle:focus-visible,
  .btn:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
  }

  button {
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .dir-toggle,
    input[type='search'],
    select,
    .btn {
      transition: none;
    }
  }
</style>