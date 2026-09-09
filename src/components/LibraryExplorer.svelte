<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  interface Candidate {
    appid: number;
    name: string;
    headerImageUrl: string | null;
    genres: string[] | null;
    releaseDate: string | null;
    achievementsUnlocked: number;
    totalAchievements: number;
    achievementsRemaining: number;
    completionPercent: number;
    playtimeMinutes: number;
    estimatedTimeToPlatinum: number | null;
    hasTimeEstimate: boolean;
    avgGlobalRarityRemaining: number | null;
    difficultyScore: number;
  }

  interface ApiResponse {
    candidates: Candidate[];
    meta: { total: number; partialEstimates: number; availableGenres: string[] };
    error?: string;
  }

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

  let { syncing = false }: { syncing?: boolean } = $props();

  let filters = $state<Filters>({
    search: '',
    progress: 'all',
    showCompleted: false,
    achievementsMin: '',
    achievementsMax: '',
    timeMin: '',
    timeMax: '',
    includeNoTime: true,
    genre: '',
    sort: 'difficulty',
    direction: 'asc',
  });

  let candidates = $state.raw<Candidate[]>([]);
  let availableGenres = $state.raw<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let total = $state(0);
  let partialEstimates = $state(0);

  // Unified debounce for every filter change (search + selects + toggles), so
  // rapid interactions collapse into a single request per burst.
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  // In-flight request: cancel it when a newer filter state supersedes it, so we
  // never apply an out-of-order response nor waste a round-trip.
  let controller: AbortController | undefined;
  // Last request we actually sent; identical re-requests are skipped (e.g. the
  // user toggles a filter back to the state that's already on screen).
  let lastRequestKey = '';
  // Small TTL cache keyed by the query string. Data only changes on the daily
  // cron, so re-visiting a recent filter set can be served instantly without
  // touching the server.
  const cache = new Map<string, { data: ApiResponse; at: number }>();
  const CACHE_TTL_MS = 60_000;

  const hasActiveFilters = $derived(
    filters.search !== '' ||
      filters.progress !== 'all' ||
      filters.showCompleted ||
      filters.achievementsMin !== '' ||
      filters.achievementsMax !== '' ||
      filters.timeMin !== '' ||
      filters.timeMax !== '' ||
      !filters.includeNoTime ||
      filters.genre !== '',
  );

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('state', filters.progress);
    params.set('showCompleted', filters.showCompleted ? 'true' : 'false');
    params.set('includeNoTime', filters.includeNoTime ? 'true' : 'false');
    params.set('sort', filters.sort);
    params.set('direction', filters.direction);
    if (filters.search) params.set('search', filters.search);
    if (filters.achievementsMin) params.set('achievementsMin', filters.achievementsMin);
    if (filters.achievementsMax) params.set('achievementsMax', filters.achievementsMax);
    if (filters.timeMin) params.set('timeMinHours', filters.timeMin);
    if (filters.timeMax) params.set('timeMaxHours', filters.timeMax);
    if (filters.genre) params.set('genre', filters.genre);
    return params;
  }

  function syncUrl(): void {
    const params = buildParams();
    const next = `${location.pathname}?${params.toString()}`;
    history.replaceState(null, '', next);
  }

  function applyData(data: ApiResponse): void {
    candidates = data.candidates;
    availableGenres = data.meta.availableGenres;
    total = data.meta.total;
    partialEstimates = data.meta.partialEstimates;
  }

  async function load(): Promise<void> {
    const key = requestKey();
    if (key === lastRequestKey) return;
    lastRequestKey = key;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      applyData(hit.data);
      return;
    }

    loading = candidates.length === 0;
    error = null;
    controller?.abort();
    controller = new AbortController();
    const myController = controller;
    try {
      const res = await fetch(`/api/games/platinum-candidates?${key}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      if (!data.candidates) {
        error = data.error ?? 'Respuesta inesperada';
        return;
      }
      // A newer filter state started a request meanwhile: drop this one.
      if (controller !== myController) return;
      cache.set(key, { data, at: Date.now() });
      applyData(data);
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function requestKey(): string {
    return buildParams().toString();
  }

  function scheduleReload(delay = 220): void {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void reload(), delay);
  }

  function reload(): void {
    const key = requestKey();
    if (key === lastRequestKey && candidates.length > 0 && !error) return;
    syncUrl();
    void load();
  }

  function onSearchInput(): void {
    scheduleReload(320);
  }

  function onFilterChange(): void {
    scheduleReload();
  }

  function resetFilters(): void {
    clearTimeout(reloadTimer);
    filters = {
      search: '',
      progress: 'all',
      showCompleted: false,
      achievementsMin: '',
      achievementsMax: '',
      timeMin: '',
      timeMax: '',
      includeNoTime: true,
      genre: '',
      sort: filters.sort,
      direction: filters.direction,
    };
    syncUrl();
    void load();
  }

  function initFromUrl(): void {
    const sp = new URLSearchParams(location.search);
    const next: Filters = { ...filters };
    const state = sp.get('state');
    if (state === 'unplayed' || state === 'started' || state === 'completed') next.progress = state;
    const sort = sp.get('sort');
    if (sort === 'difficulty' || sort === 'remaining' || sort === 'time' || sort === 'rarity') {
      next.sort = sort;
    }
    const direction = sp.get('direction');
    if (direction === 'asc' || direction === 'desc') next.direction = direction;
    if (sp.get('showCompleted') === 'true') next.showCompleted = true;
    if (sp.get('includeNoTime') === 'false') next.includeNoTime = false;
    const search = sp.get('search');
    if (search) next.search = search;
    const achievementsMin = sp.get('achievementsMin');
    if (achievementsMin) next.achievementsMin = achievementsMin;
    const achievementsMax = sp.get('achievementsMax');
    if (achievementsMax) next.achievementsMax = achievementsMax;
    const timeMin = sp.get('timeMinHours');
    if (timeMin) next.timeMin = timeMin;
    const timeMax = sp.get('timeMaxHours');
    if (timeMax) next.timeMax = timeMax;
    const genre = sp.get('genre');
    if (genre) next.genre = genre;
    filters = next;
  }

  onMount(() => {
    initFromUrl();
    void load();
  });

  onDestroy(() => {
    clearTimeout(reloadTimer);
    controller?.abort();
  });

  function hours(minutes: number): string {
    const h = minutes / 60;
    if (h < 1) return `${Math.max(Math.round(minutes), 0)}min`;
    return `${Math.round(h)}h`;
  }

  function timeLabel(c: Candidate): string {
    if (!c.hasTimeEstimate || c.estimatedTimeToPlatinum === null) return 'Sin dato';
    const t = Math.round(c.estimatedTimeToPlatinum);
    return `~${t}h`;
  }

  function genresOf(c: Candidate): string {
    return c.genres?.slice(0, 2).join(' · ') ?? '';
  }

  function yearOf(c: Candidate): string | null {
    return c.releaseDate ? c.releaseDate.slice(0, 4) : null;
  }

  function difficultyLabel(score: number): string {
    if (score <= 30) return 'Fácil';
    if (score <= 60) return 'Medio';
    return 'Largo';
  }

  function difficultyClass(score: number): string {
    if (score <= 30) return 'easy';
    if (score <= 60) return 'mid';
    return 'hard';
  }

  function sortLabel(key: string): string {
    return {
      difficulty: 'Recomendado',
      remaining: 'Logros restantes',
      time: 'Tiempo estimado',
      rarity: 'Rareza de logros', 
    }[key] ?? key;
  }
</script>

<section class="explorer">
  <header class="toolbar" aria-label="Filtros y ordenación">
    <div class="toolbar-actions">
      <div class="field grow">
        <label for="fx-search" class="sr-only">Buscar por nombre</label>
        <input
          id="fx-search"
          type="search"
          name="search"
          placeholder="Buscar juego…"
          autocomplete="off"
          spellcheck={false}
          bind:value={filters.search}
          oninput={onSearchInput}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              clearTimeout(reloadTimer);
              reload();
            }
          }}
        />
      </div>

      <div class="field">
        <label for="fx-progress">Progreso</label>
        <select id="fx-progress" name="state" bind:value={filters.progress} onchange={onFilterChange}>
          <option value="all">Todos</option>
          <option value="unplayed">Sin jugar</option>
          <option value="started">Empezados</option>
          <option value="completed">Completados</option>
        </select>
      </div>

      <div class="field">
        <label for="fx-genre">Género</label>
        <select id="fx-genre" name="genre" bind:value={filters.genre} onchange={onFilterChange}>
          <option value="">Todos</option>
          {#each availableGenres as g (g)}
            <option value={g}>{g}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <label for="fx-sort">Ordenar</label>
        <select id="fx-sort" name="sort" bind:value={filters.sort} onchange={onFilterChange}>
          <option value="difficulty">Recomendado</option>
          <option value="remaining">Logros restantes</option>
          <option value="time">Tiempo estimado</option>
          <option value="rarity">Rareza de logros</option>
        </select>
      </div>

      <div class="field">
        <label for="fx-direction">Dirección</label>
        <select id="fx-direction" name="direction" bind:value={filters.direction} onchange={onFilterChange}>
          <option value="asc">Asc</option>
          <option value="desc">Desc</option>
        </select>
      </div>
    </div>

    <div class="toolbar-ranges">
      <div class="field small">
        <label for="fx-rem-min">Logros ≥</label>
        <input
          id="fx-rem-min"
          type="number"
          name="achievementsMin"
          min="0"
          autocomplete="off"
          bind:value={filters.achievementsMin}
          onchange={onFilterChange}
        />
      </div>
      <div class="field small">
        <label for="fx-rem-max">Logros ≤</label>
        <input
          id="fx-rem-max"
          type="number"
          name="achievementsMax"
          min="0"
          autocomplete="off"
          bind:value={filters.achievementsMax}
          onchange={onFilterChange}
        />
      </div>
      <div class="field small">
        <label for="fx-time-min">Horas ≥</label>
        <input
          id="fx-time-min"
          type="number"
          name="timeMinHours"
          min="0"
          step="1"
          autocomplete="off"
          bind:value={filters.timeMin}
          onchange={onFilterChange}
        />
      </div>
      <div class="field small">
        <label for="fx-time-max">Horas ≤</label>
        <input
          id="fx-time-max"
          type="number"
          name="timeMaxHours"
          min="0"
          step="1"
          autocomplete="off"
          bind:value={filters.timeMax}
          onchange={onFilterChange}
        />
      </div>

      <label class="check" for="fx-notime">
        <input id="fx-notime" type="checkbox" bind:checked={filters.includeNoTime} onchange={onFilterChange} />
        <span>Incluir juegos sin dato de tiempo</span>
      </label>
      <label class="check" for="fx-completed">
        <input id="fx-completed" type="checkbox" bind:checked={filters.showCompleted} onchange={onFilterChange} />
        <span>Ver platinados (100%)</span>
      </label>
      {#if hasActiveFilters}
        <button class="link-btn" type="button" onclick={resetFilters}>Limpiar filtros</button>
      {/if}
    </div>
  </header>

  <div class="summary" aria-live="polite">
    {#if loading}
      <span class="chip pulse">Cargando…</span>
    {/if}
    {#if syncing}
      <p class="notice">
        Mi biblioteca aún se está sincronizando por primera vez. Algunos juegos
        pueden aparecer con datos incompletos hasta que termine.
      </p>
    {/if}
    <p class="count">
      <strong>{total}</strong> {total === 1 ? 'candidato' : 'candidatos'}
      {#if partialEstimates > 0}
        · {partialEstimates} sin estimación de tiempo
      {/if}
    </p>
    {#if error}
      <p class="error" role="alert">
        No se pudo cargar la lista: {error}. Reintenta en unos segundos o recarga la página.
      </p>
    {/if}
  </div>

  {#if !loading && candidates.length === 0 && !error}
    <div class="empty">
      <p>No encuentro juegos con estos filtros.</p>
      {#if hasActiveFilters}
        <button class="link-btn" type="button" onclick={resetFilters}>Limpiar filtros</button>
      {/if}
    </div>
  {:else}
    <ul class="grid">
      {#each candidates as c (c.appid)}
        <li class="card">
          <div class="cover">
            {#if c.headerImageUrl}
              <img src={c.headerImageUrl} alt="" width="92" height="42" loading="lazy" />
            {:else}
              <div class="cover-fallback" aria-hidden="true">?</div>
            {/if}
          </div>

          <div class="info">
            <h2 class="name">{c.name}</h2>
            <p class="meta">
              {genresOf(c)}
              {#if yearOf(c)}· {yearOf(c)}{/if}
            </p>
            <div class="progress" role="img" aria-label={`${c.completionPercent}% completado`}>
              <div class="progress-rail">
                <div class="progress-fill" style:width="{c.completionPercent}%"></div>
              </div>
              <span class="progress-num">{c.completionPercent}%</span>
              <span class="counts">{c.achievementsUnlocked}/{c.totalAchievements}</span>
            </div>
          </div>

          <dl class="stats">
            <div>
              <dt>Faltan</dt>
              <dd>{c.achievementsRemaining}</dd>
            </div>
            <div>
              <dt>Tiempo Estimado</dt>
              <dd class={c.hasTimeEstimate ? '' : 'muted'}>
                {timeLabel(c)}
                {#if !c.hasTimeEstimate}
                  <span class="tip" title="Estimación basada en HowLongToBeat. Sin dato para este juego, ordena aparte, nunca se inventa." aria-label="Sin estimación de tiempo">ⓘ</span>
                {/if}
              </dd>
            </div>
            <div>
              <dt>Dificultad</dt>
              <dd>
                <span
                  class="badge {difficultyClass(c.difficultyScore)}"
                  title={`Score ${Number(c.difficultyScore).toFixed(1)} (menor = más cerca de platinar)`}
                >
                  {difficultyLabel(c.difficultyScore)}
                </span>
              </dd>
            </div>
          </dl>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="footnote">
    Estimaciones basadas en HowLongToBeat, pueden no ser exactas. No afiliado a
    Valve ni a Steam.
  </p>
</section>

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .toolbar {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.18));
    border-radius: 14px;
    background: color-mix(in srgb, var(--surface, #0f1420) 88%, transparent);
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  }

  .toolbar-actions,
  .toolbar-ranges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    align-items: flex-end;
  }
  .toolbar-ranges {
    row-gap: 0.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .field.grow {
    flex: 1 1 220px;
    min-width: 220px;
  }
  .field.small {
    width: 92px;
  }

  .field label {
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }

  input[type='search'],
  input[type='number'],
  select {
    font: inherit;
    color: inherit;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 10px;
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
    font-size: 0.875rem;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    padding-bottom: 0.45rem;
  }
  .check input {
    accent-color: var(--accent, #7c8dff);
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

  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    align-items: flex-start;
  }
  .notice {
    margin: 0;
    padding: 0.6rem 0.85rem;
    border-radius: 10px;
    border: 1px dashed var(--border, rgba(148, 163, 184, 0.3));
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
  }
  .count {
    margin: 0;
    color: var(--muted, #94a3b8);
    font-size: 0.875rem;
  }
  .count strong {
    color: var(--text, #f1f5f9);
  }
  .error {
    margin: 0;
    color: #f87171;
    font-size: 0.875rem;
  }
  .chip {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    color: var(--accent, #7c8dff);
    background: color-mix(in srgb, var(--accent, #7c8dff) 12%, transparent);
  }
  .pulse {
    animation: pulse 1.2s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }

  .empty {
    padding: 2.5rem 1rem;
    text-align: center;
    color: var(--muted, #94a3b8);
    border: 1px dashed var(--border, rgba(148, 163, 184, 0.28));
    border-radius: 14px;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.7rem;
  }

  .card {
    display: grid;
    grid-template-columns: 92px 1fr auto;
    align-items: center;
    gap: 1rem;
    padding: 0.7rem 0.9rem;
    border-radius: 14px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.14));
    background: color-mix(in srgb, var(--surface, #0f1420) 75%, #000);
    content-visibility: auto;
    contain-intrinsic-size: auto 90px;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--border, rgba(148, 163, 184, 0.32));
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  }

  .cover {
    width: 92px;
    height: 42px;
    border-radius: 8px;
    overflow: hidden;
    background: linear-gradient(135deg, #334155, #1e293b);
  }
  .cover img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .cover-fallback {
    display: grid;
    place-items: center;
    height: 100%;
    color: #64748b;
    font-weight: 700;
  }

  .info {
    min-width: 0;
  }
  .name {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    margin: 0.1rem 0 0.5rem;
    font-size: 0.78rem;
    color: var(--muted, #94a3b8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 420px;
  }
  .progress-rail {
    flex: 1 1 auto;
    height: 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text, #f1f5f9) 12%, transparent);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #7c8dff, #b06ab3);
  }
  .progress-num {
    font-size: 0.72rem;
    font-weight: 700;
    min-width: 2.6rem;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .counts {
    font-size: 0.72rem;
    color: var(--muted, #94a3b8);
    font-variant-numeric: tabular-nums;
  }

  .stats {
    display: flex;
    gap: 1.15rem;
    margin: 0;
  }
  .stats div {
    text-align: right;
  }
  .stats dt {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted, #94a3b8);
  }
  .stats dd {
    margin: 0.15rem 0 0;
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--muted, #94a3b8);
    font-weight: 500 !important;
  }
  .tip {
    font-size: 0.75rem;
    cursor: help;
  }

  .badge {
    display: inline-block;
    padding: 0.16rem 0.55rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .badge.easy {
    color: #34d399;
    background: color-mix(in srgb, #34d399 14%, transparent);
  }
  .badge.mid {
    color: #fbbf24;
    background: color-mix(in srgb, #fbbf24 14%, transparent);
  }
  .badge.hard {
    color: #fb7185;
    background: color-mix(in srgb, #fb7185 14%, transparent);
  }

  .footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted, #64748b);
    text-align: center;
  }

  input[type='search'],
  input[type='number'],
  select,
  button {
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .toolbar,
    .link-btn,
    input[type='search'],
    input[type='number'],
    select {
      transition: none;
    }
    .pulse {
      animation: none;
    }
  }

  @media (max-width: 720px) {
    .card {
      grid-template-columns: 92px 1fr;
    }
    .stats {
      grid-column: 1 / -1;
      justify-content: space-between;
      padding-top: 0.4rem;
      border-top: 1px solid var(--border, rgba(148, 163, 184, 0.12));
    }
    .stats div {
      text-align: left;
    }
  }
</style>