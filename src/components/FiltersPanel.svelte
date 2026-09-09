<script lang="ts">
  interface Filters {
    search: string;
    progress: string;
    showCompleted: boolean;
    achievementsMin: string;
    achievementsMax: string;
    timeMin: string;
    timeMax: string;
    includeNoTime: boolean;
    genre: string;
    sort: string;
    direction: string;
  }

  // `filters` is the reactive $state object owned by LibraryExplorer; controls
  // mutate its fields in place so the parent's derived view updates instantly.
  // `idPrefix` keeps ids unique when the panel is rendered twice (sidebar +
  // mobile modal) on the same page.
  let {
    filters,
    availableGenres = [],
    activeCount = 0,
    onreset,
    idPrefix = 'filters',
  }: {
    filters: Filters;
    availableGenres?: string[];
    activeCount?: number;
    onreset?: () => void;
    idPrefix?: string;
  } = $props();
</script>

<div class="filters-panel" role="group" aria-label="Filtros y ordenación">
  <div class="actions">
    <div class="field grow">
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

    <div class="field">
      <label for={`${idPrefix}-direction`}>Dirección</label>
      <select id={`${idPrefix}-direction`} name="direction" bind:value={filters.direction}>
        <option value="asc">Asc</option>
        <option value="desc">Desc</option>
      </select>
    </div>
  </div>

  <div class="ranges">
    <div class="field small">
      <label for={`${idPrefix}-rem-min`}>Logros ≥</label>
      <input
        id={`${idPrefix}-rem-min`}
        type="number"
        name="achievementsMin"
        min="0"
        autocomplete="off"
        bind:value={filters.achievementsMin}
      />
    </div>
    <div class="field small">
      <label for={`${idPrefix}-rem-max`}>Logros ≤</label>
      <input
        id={`${idPrefix}-rem-max`}
        type="number"
        name="achievementsMax"
        min="0"
        autocomplete="off"
        bind:value={filters.achievementsMax}
      />
    </div>
    <div class="field small">
      <label for={`${idPrefix}-time-min`}>Horas ≥</label>
      <input
        id={`${idPrefix}-time-min`}
        type="number"
        name="timeMinHours"
        min="0"
        step="1"
        autocomplete="off"
        bind:value={filters.timeMin}
      />
    </div>
    <div class="field small">
      <label for={`${idPrefix}-time-max`}>Horas ≤</label>
      <input
        id={`${idPrefix}-time-max`}
        type="number"
        name="timeMaxHours"
        min="0"
        step="1"
        autocomplete="off"
        bind:value={filters.timeMax}
      />
    </div>

    <label class="check" for={`${idPrefix}-notime`}>
      <input id={`${idPrefix}-notime`} type="checkbox" bind:checked={filters.includeNoTime} />
      <span>Incluir juegos sin dato de tiempo</span>
    </label>
    <label class="check" for={`${idPrefix}-completed`}>
      <input id={`${idPrefix}-completed`} type="checkbox" bind:checked={filters.showCompleted} />
      <span>Ver platinados (100%)</span>
    </label>
    {#if activeCount > 0 && onreset}
      <button class="link-btn" type="button" onclick={onreset}>Limpiar filtros</button>
    {/if}
  </div>
</div>

<style>
  .filters-panel {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 0.7rem 0.8rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.18));
    border-radius: 12px;
    background: color-mix(in srgb, var(--surface, #0f1420) 88%, transparent);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .actions,
  .ranges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-end;
  }
  .ranges {
    row-gap: 0.4rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .field.grow {
    flex: 1 1 100%;
    min-width: 100%;
  }
  .field.small {
    width: 80px;
  }

  .field label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }

  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    font-size: 0.875rem;
    color: inherit;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 9px;
    background: color-mix(in srgb, var(--surface, #0f1420) 60%, #000);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }
  input[type='search']:focus-visible,
  input[type='number']:focus-visible,
  select:focus-visible {
    outline: none;
    border-color: var(--accent, #7c8dff);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #7c8dff) 25%, transparent);
  }

  .check {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    padding-bottom: 0.28rem;
  }
  .check input {
    accent-color: var(--accent, #7c8dff);
  }

  .link-btn {
    font: inherit;
    color: var(--accent, #7c8dff);
    background: none;
    border: none;
    padding: 0.35rem 0.25rem;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    transition: color 0.15s ease;
  }
  .link-btn:hover {
    color: color-mix(in srgb, var(--accent, #7c8dff) 75%, #fff);
  }
  .link-btn:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
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

  input[type='number'],
  select,
  button {
    touch-action: manipulation;
  }
</style>