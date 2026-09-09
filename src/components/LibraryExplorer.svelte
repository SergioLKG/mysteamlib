<script lang="ts">
  import { tick } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import FiltersPanel from './FiltersPanel.svelte';

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
    games: Candidate[];
    meta: { availableGenres: string[] };
    error?: string;
  }

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

  // Caps for the dual-range sliders (min always 0).
  const ACH_MAX = 150;
  const TIME_MAX = 500;

  let { syncing = false }: { syncing?: boolean } = $props();

  let filters = $state<Filters>({
    search: '',
    progress: 'all',
    showCompleted: false,
    achievementsMin: 0,
    achievementsMax: ACH_MAX,
    timeMin: 0,
    timeMax: TIME_MAX,
    includeNoTime: true,
    genre: '',
    sort: 'difficulty',
    direction: 'asc',
  });

  // Full per-user dataset, fetched ONCE on mount. Filters and sorting run
  // locally in a pure $derived below, so interactivity never touches the
  // server: instant feedback, zero extra requests. Data only changes on the
  // daily cron, so staleness within the session is a non-issue.
  let games = $state.raw<Candidate[]>([]);
  let availableGenres = $state.raw<string[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);
  // Handle for the in-flight fetch (initial load + manual refresh).
  let controller: AbortController | undefined;

  const activeCount = $derived(
    (filters.search !== '' ? 1 : 0) +
      (filters.progress !== 'all' ? 1 : 0) +
      (filters.showCompleted ? 1 : 0) +
      (filters.achievementsMin > 0 ? 1 : 0) +
      (filters.achievementsMax < ACH_MAX ? 1 : 0) +
      (filters.timeMin > 0 ? 1 : 0) +
      (filters.timeMax < TIME_MAX ? 1 : 0) +
      (filters.includeNoTime ? 0 : 1) +
      (filters.genre !== '' ? 1 : 0),
  );
  const hasActiveFilters = $derived(activeCount > 0);

  // Mobile filters open as an overlay (modal); desktop keeps the same panel
  // in a sticky sidebar. Focus moves to the close button on open and returns
  // to the toggle when closing (Esc / backdrop / close all supported).
  let filterOpen = $state(false);
  let filterToggleBtn: HTMLButtonElement | undefined;
  let filterCloseBtn: HTMLButtonElement | undefined;

  function openFilters(): void {
    filterOpen = true;
  }

  function closeFilters(): void {
    if (!filterOpen) return;
    filterOpen = false;
    filterToggleBtn?.focus();
  }

  function onWindowKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') closeFilters();
  }

  function onModalBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) closeFilters();
  }

  function closeFiltersIfDesktop(): void {
    if (window.innerWidth >= 1024) closeFilters();
  }

  $effect(() => {
    if (filterOpen) {
      void tick().then(() => filterCloseBtn?.focus());
    }
  });

  // Reactive view over the full dataset. Recomputes instantly on every filter
  // change and replicates the server-side semantics (state, exact genre match,
  // case-insensitive name search, nulls always last, name as tiebreak).
  const view = $derived.by(() => buildView(games, filters));
  const total = $derived(view.length);
  const partialEstimates = $derived(view.filter((c) => !c.hasTimeEstimate).length);

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    params.set('state', filters.progress);
    params.set('showCompleted', filters.showCompleted ? 'true' : 'false');
    params.set('includeNoTime', filters.includeNoTime ? 'true' : 'false');
    params.set('sort', filters.sort);
    params.set('direction', filters.direction);
    if (filters.search) params.set('search', filters.search);
    if (filters.achievementsMin > 0) params.set('achievementsMin', String(filters.achievementsMin));
    if (filters.achievementsMax < ACH_MAX) params.set('achievementsMax', String(filters.achievementsMax));
    if (filters.timeMin > 0) params.set('timeMinHours', String(filters.timeMin));
    if (filters.timeMax < TIME_MAX) params.set('timeMaxHours', String(filters.timeMax));
    if (filters.genre) params.set('genre', filters.genre);
    return params;
  }

  function syncUrl(): void {
    const params = buildParams();
    const next = `${location.pathname}?${params.toString()}`;
    history.replaceState(null, '', next);
  }

  // Keep the URL in sync with the current filters (pure client-side; no
  // refetch). Users can share/copy the exact filtered view.
  $effect(() => {
    if (typeof window === 'undefined') return;
    // touch every filter field so the effect reacts to any change
    void filters.search;
    void filters.progress;
    void filters.showCompleted;
    void filters.achievementsMin;
    void filters.achievementsMax;
    void filters.timeMin;
    void filters.timeMax;
    void filters.includeNoTime;
    void filters.genre;
    void filters.sort;
    void filters.direction;
    syncUrl();
  });

  async function load(): Promise<void> {
    error = null;
    loading = true;
    controller?.abort();
    controller = new AbortController();
    try {
      const res = await fetch('/api/games/platinum-candidates', { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ApiResponse;
      if (!data.games) {
        error = data.error ?? 'Respuesta inesperada';
        return;
      }
      games = data.games;
      availableGenres = data.meta.availableGenres;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function refresh(): void {
    void load();
  }

  function resetFilters(): void {
    filters = {
      search: '',
      progress: 'all',
      showCompleted: false,
      achievementsMin: 0,
      achievementsMax: ACH_MAX,
      timeMin: 0,
      timeMax: TIME_MAX,
      includeNoTime: true,
      genre: '',
      sort: filters.sort,
      direction: filters.direction,
    };
  }

  function toggleDirection(): void {
    filters.direction = filters.direction === 'desc' ? 'asc' : 'desc';
  }

  function cmpName(a: Candidate, b: Candidate): number {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  }

  function cmpNullsLast(a: number | null, b: number | null, asc: boolean): number {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return asc ? a - b : b - a;
  }

  function buildView(all: Candidate[], f: Filters): Candidate[] {
    const q = f.search.trim().toLowerCase();
    const timeMin = f.timeMin > 0 ? f.timeMin : undefined;
    const timeMax = f.timeMax < TIME_MAX ? f.timeMax : undefined;
    const remMin = f.achievementsMin > 0 ? f.achievementsMin : undefined;
    const remMax = f.achievementsMax < ACH_MAX ? f.achievementsMax : undefined;
    const showCompleted = f.showCompleted || f.progress === 'completed';

    const list: Candidate[] = [];
    for (const c of all) {
      const rem = c.achievementsRemaining;
      if (!showCompleted && rem === 0) continue;
      if (f.progress === 'unplayed' && c.playtimeMinutes !== 0) continue;
      if (f.progress === 'started' && !(c.achievementsUnlocked > 0 && rem > 0)) continue;
      if (f.progress === 'completed' && rem !== 0) continue;
      if (!f.includeNoTime && !c.hasTimeEstimate) continue;
      if (f.genre && !(c.genres?.includes(f.genre))) continue;
      if (q && !c.name.toLowerCase().includes(q)) continue;
      if (remMin !== undefined && rem < remMin) continue;
      if (remMax !== undefined && rem > remMax) continue;
      if (timeMin !== undefined && (c.estimatedTimeToPlatinum === null || c.estimatedTimeToPlatinum < timeMin)) continue;
      if (timeMax !== undefined && (c.estimatedTimeToPlatinum === null || c.estimatedTimeToPlatinum > timeMax)) continue;
      list.push(c);
    }

    const asc = f.direction !== 'desc';
    const valueFn = (c: Candidate): number | null => {
      switch (f.sort) {
        case 'remaining':
          return c.achievementsRemaining;
        case 'time':
          return c.estimatedTimeToPlatinum;
        case 'rarity':
          return c.avgGlobalRarityRemaining;
        case 'difficulty':
        default:
          return c.difficultyScore;
      }
    };
    list.sort((a, b) => {
      const by = cmpNullsLast(valueFn(a), valueFn(b), asc);
      return by !== 0 ? by : cmpName(a, b);
    });
    return list;
  }

  function clampNum(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
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
    if (achievementsMin) next.achievementsMin = clampNum(Number(achievementsMin), 0, ACH_MAX);
    const achievementsMax = sp.get('achievementsMax');
    if (achievementsMax) next.achievementsMax = clampNum(Number(achievementsMax), 0, ACH_MAX);
    const timeMin = sp.get('timeMinHours');
    if (timeMin) next.timeMin = clampNum(Number(timeMin), 0, TIME_MAX);
    const timeMax = sp.get('timeMaxHours');
    if (timeMax) next.timeMax = clampNum(Number(timeMax), 0, TIME_MAX);
    const genre = sp.get('genre');
    if (genre) next.genre = genre;
    // Set with an explicit write so the URL-sync effect re-runs afterwards.
    filters = next;
  }

  onMount(() => {
    initFromUrl();
    void load();
  });

  onDestroy(() => {
    controller?.abort();
  });

  function timeBadge(c: Candidate): string {
    return `~${Math.round(c.estimatedTimeToPlatinum ?? 0)}h`;
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
</script>

<section class="explorer">
  <div class="layout" inert={filterOpen}>
    <aside class="filters-side">
      <FiltersPanel
        {filters}
        {availableGenres}
        activeCount={activeCount}
        direction={filters.direction}
        onreset={resetFilters}
        onToggleDirection={toggleDirection}
        idPrefix="side"
      />
    </aside>

    <div class="section">
      <div class="main-head">
        <button
          class="filters-toggle"
          type="button"
          bind:this={filterToggleBtn}
          aria-expanded={filterOpen}
          aria-controls="mobile-filters"
          onclick={openFilters}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 6h16M7 12h10M10 18h4" />
          </svg>
          Filtros
          {#if activeCount > 0}
            <span class="count-badge">{activeCount}</span>
          {/if}
        </button>
      </div>

      <div class="summary" aria-live="polite" aria-busy={loading}>
    {#if loading && games.length === 0}
      <span class="chip pulse">Cargando…</span>
    {/if}
    {#if syncing}
      <p class="notice">
        Mi biblioteca aún se está sincronizando por primera vez. Algunos juegos
        pueden aparecer con datos incompletos hasta que termine.
      </p>
    {/if}
    {#if error}
      <p class="error" role="alert">
        No se pudo cargar la lista: {error}. Reintenta en unos segundos o recarga la página.
      </p>
    {/if}
    <div class="count-row">
      <p class="count">
        <strong>{total}</strong> {total === 1 ? 'candidato' : 'candidatos'}
        {#if partialEstimates > 0}
          · {partialEstimates} sin estimación de tiempo
        {/if}
      </p>
      <div class="count-actions">
        <button
          class="dir-toggle"
          type="button"
          onclick={toggleDirection}
          title="Cambiar dirección del orden"
          aria-label={`Cambiar dirección del orden — actualmente ${filters.direction === 'asc' ? 'ascendente' : 'descendente'}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m3 8 4-4 4 4" />
            <path d="M7 4v16" />
            <path d="m21 16-4 4-4-4" />
            <path d="M17 20V4" />
          </svg>
          <span class="dir-label">{filters.direction === 'asc' ? 'Asc' : 'Desc'}</span>
        </button>
        <button class="link-btn refresh" type="button" onclick={refresh} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar datos'}
        </button>
      </div>
    </div>
  </div>

  {#if loading && games.length === 0 && !error}
    <div class="skeleton" role="status" aria-label="Cargando mi lista">
      {#each Array(6) as _, i (i)}
        <div class="skeleton-card" aria-hidden="true">
          <span class="sk sk-cover"></span>
          <span class="sk sk-line sk-name"></span>
          <span class="sk sk-line sk-meta"></span>
          <span class="sk sk-rail"></span>
        </div>
      {/each}
    </div>
  {:else if view.length === 0 && !error}
    <div class="empty">
      <svg
        class="empty-icon"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
      <p class="empty-title">Nada por aquí…</p>
      <p class="empty-text">
        Con estos filtros no encuentro ningún juego. Prueba a soltar un poco o
        a limpiarlos.
      </p>
      {#if hasActiveFilters}
        <button class="btn-reset" type="button" onclick={resetFilters}>Limpiar filtros</button>
      {/if}
    </div>
  {:else}
    <ul class="grid">
      {#each view as c, i (c.appid)}
        <li
          class="card {c.achievementsRemaining === 0 ? 'platinum' : ''}"
          style:--i={Math.min(i, 7)}
        >
          <div class="media">
            <a
              class="store-link cover"
              href={`https://store.steampowered.com/app/${c.appid}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${c.name} — abrir en Steam`}
              title={`Ver ${c.name} en la tienda de Steam`}
            >
              {#if c.headerImageUrl}
                <img src={c.headerImageUrl} alt="" width="460" height="215" loading="lazy" />
              {:else}
                <div class="cover-fallback" aria-hidden="true">?</div>
              {/if}
            </a>
            <div class="corner">
              {#if c.achievementsRemaining === 0}
                <span class="seal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                    <path d="M4 22h16" />
                    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                    <path d="M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79" />
                    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                  </svg>
                  Platinado
                </span>
              {:else}
                <span class="badge">Faltan {c.achievementsRemaining}</span>
                {#if c.hasTimeEstimate && c.estimatedTimeToPlatinum !== null}
                  <span class="badge">{timeBadge(c)}</span>
                {/if}
                <span class="badge diff-{difficultyClass(c.difficultyScore)}">
                  {difficultyLabel(c.difficultyScore)}
                </span>
              {/if}
            </div>
          </div>

          <div class="body">
            <a
              class="store-link name-link"
              href={`https://store.steampowered.com/app/${c.appid}`}
              target="_blank"
              rel="noopener noreferrer"
              title={`Ver ${c.name} en la tienda de Steam`}
            >
              <h3 class="name">{c.name}</h3>
            </a>
            <p class="meta">
              {genresOf(c)}
              {#if yearOf(c)}· {yearOf(c)}{/if}
            </p>
            <div class="bar-wrap">
              <div
                class="bar"
                role="progressbar"
                aria-valuenow={c.completionPercent}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`${c.name} — ${c.completionPercent}% completado`}
              >
                <div class="bar-fill" style:width="{c.completionPercent}%"></div>
                <span class="bar-text">{c.completionPercent}%</span>
              </div>
              <span class="bar-counts">{c.achievementsUnlocked}/{c.totalAchievements}</span>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  <p class="footnote">
    Estimaciones basadas en HowLongToBeat, pueden no ser exactas. No afiliado a
    Valve ni a Steam.
  </p>
    </div>
  </div>

  {#if filterOpen}
    <div class="modal-backdrop" onclick={onModalBackdropClick}>
      <div
        class="modal"
        id="mobile-filters"
        role="dialog"
        aria-modal="true"
        aria-label="Filtros y ordenación"
      >
        <div class="modal-head">
          <h2 class="modal-title">Filtros</h2>
          <button
            class="modal-close"
            type="button"
            aria-label="Cerrar filtros"
            bind:this={filterCloseBtn}
            onclick={closeFilters}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <FiltersPanel
          filters={filters}
          availableGenres={availableGenres}
          activeCount={activeCount}
          direction={filters.direction}
          onreset={resetFilters}
          onToggleDirection={toggleDirection}
          idPrefix="modal"
        />
      </div>
    </div>
  {/if}
</section>

<svelte:window onkeydown={onWindowKeydown} onresize={closeFiltersIfDesktop} />

<style>
  .explorer {
    display: flex;
    flex-direction: column;
    gap: 1.125rem;
  }

  .layout {
    display: grid;
    gap: 1.5rem;
    align-items: start;
  }
  .section {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .filters-side {
    display: none;
  }

  .main-head {
    display: flex;
    align-items: center;
  }
  .filters-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    font: inherit;
    font-weight: 600;
    color: var(--text, #f1f5f9);
    padding: 0.5rem 0.9rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface, #0f1420) 70%, #000);
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
  }
  .filters-toggle:hover {
    border-color: var(--accent, #7c8dff);
  }
  .filters-toggle:active {
    transform: scale(0.97);
  }
  .count-badge {
    min-width: 1.3rem;
    height: 1.3rem;
    padding: 0 0.3rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: #0b1020;
    background: var(--accent, #7c8dff);
  }

  @media (min-width: 1024px) {
    .layout {
      grid-template-columns: 250px minmax(0, 1fr);
    }
    .filters-side {
      display: block;
      position: sticky;
      top: calc(var(--header-h, 3.875rem) + 1.25rem);
    }
    .filters-toggle {
      display: none;
    }
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(3, 7, 18, 0.62);
    backdrop-filter: blur(6px);
    animation: fade-in 0.18s ease;
  }
  .modal {
    width: min(100%, 420px);
    max-height: 86vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 16px;
    background: var(--surface, #0f1420);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    animation: rise-in 0.22s cubic-bezier(0.22, 0.68, 0.28, 1);
  }
  .modal-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .modal-title {
    margin: 0;
    font-size: 1.05rem;
  }
  .modal-close {
    display: grid;
    place-items: center;
    width: 2.1rem;
    height: 2.1rem;
    border: none;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text, #f1f5f9) 10%, transparent);
    color: inherit;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .modal-close:hover {
    background: color-mix(in srgb, var(--text, #f1f5f9) 18%, transparent);
  }
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes rise-in {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  a:focus-visible,
  button:focus-visible,
  .link-btn:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
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
    font-variant-numeric: tabular-nums;
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

  .count .refresh {
    margin-left: 0;
  }
  .count-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    width: 100%;
  }
  .count-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .dir-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.32rem 0.7rem;
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
  .count .refresh {
    color: var(--muted, #94a3b8);
    text-decoration: none;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.24));
    border-radius: 999px;
    padding: 0.32rem 0.8rem;
    transition: color 0.15s ease, border-color 0.15s ease;
  }
  .count .refresh:hover {
    color: var(--text, #f1f5f9);
    border-color: var(--accent, #7c8dff);
  }
  .count .refresh:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .dir-toggle:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
  }

  .skeleton {
    display: grid;
    gap: 0.7rem;
  }
  .skeleton-card {
    display: grid;
    gap: 0.9rem;
    padding: 0.9rem;
    border-radius: 16px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.1));
    background: color-mix(in srgb, var(--surface, #0f1420) 75%, #000);
  }
  .sk {
    display: block;
    border-radius: 8px;
    background: linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.08) 25%,
      rgba(148, 163, 184, 0.2) 50%,
      rgba(148, 163, 184, 0.08) 75%
    );
    background-size: 200% 100%;
    animation: shim 1.4s ease-in-out infinite;
  }
  .sk-cover {
    border-radius: 12px;
    aspect-ratio: 460 / 215;
  }
  .sk-name {
    height: 14px;
    width: 70%;
  }
  .sk-meta {
    height: 11px;
    width: 40%;
  }
  .sk-rail {
    height: 22px;
    border-radius: 999px;
    width: 100%;
  }
  @keyframes shim {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 3rem 1rem;
    text-align: center;
    color: var(--muted, #94a3b8);
    border: 1px dashed var(--border, rgba(148, 163, 184, 0.28));
    border-radius: 14px;
  }
  .empty-icon {
    opacity: 0.55;
    margin-bottom: 0.5rem;
  }
  .empty-title {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--text, #f1f5f9);
  }
  .empty-text {
    margin: 0 0 0.5rem;
    max-width: 34ch;
    text-wrap: pretty;
  }
  .btn-reset {
    font: inherit;
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.55rem 1.1rem;
    border-radius: 10px;
    color: var(--text, #f1f5f9);
    background: color-mix(in srgb, var(--surface, #0f1420) 60%, #000);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.28));
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    touch-action: manipulation;
  }
  .btn-reset:hover {
    border-color: var(--accent, #7c8dff);
    background: color-mix(in srgb, var(--accent, #7c8dff) 12%, transparent);
  }
  .btn-reset:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.7rem;
    grid-template-columns: 1fr;
  }

  @media (min-width: 1024px) {
    .grid,
    .skeleton {
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    }
  }

  .card {
    display: grid;
    gap: 0.9rem;
    padding: 0.9rem;
    border-radius: 16px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.14));
    background: color-mix(in srgb, var(--surface, #0f1420) 75%, #000);
    content-visibility: auto;
    contain-intrinsic-size: auto 300px;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    animation: card-in 0.34s cubic-bezier(0.22, 0.68, 0.28, 1) both;
    animation-delay: calc(var(--i, 0) * 30ms);
  }
  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(6px) scale(0.992);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: var(--border, rgba(148, 163, 184, 0.32));
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
  }
  .card:active {
    transform: translateY(-1px) scale(0.995);
  }

  .store-link {
    color: inherit;
    text-decoration: none;
    transition: color 0.15s ease;
  }
  .store-link:hover .name {
    color: var(--accent, #7c8dff);
  }
  .name-link {
    display: block;
    min-width: 0;
  }

  .media {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    aspect-ratio: 460 / 215;
    background: linear-gradient(135deg, #334155, #1e293b);
  }
  .cover {
    display: block;
    width: 100%;
    height: 100%;
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

  .corner {
    position: absolute;
    top: 0.55rem;
    right: 0.55rem;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.35rem;
    max-width: 94%;
    pointer-events: none;
  }
  .corner .badge {
    display: inline-block;
    padding: 0.28rem 0.6rem;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text, #eef1ff);
    background: color-mix(in srgb, #0b1020 84%, transparent);
    border: 1px solid rgba(148, 163, 184, 0.28);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }
  .badge.diff-easy {
    color: #34d399;
    border-color: color-mix(in srgb, #34d399 50%, transparent);
  }
  .badge.diff-mid {
    color: #fbbf24;
    border-color: color-mix(in srgb, #fbbf24 50%, transparent);
  }
  .badge.diff-hard {
    color: #fb7185;
    border-color: color-mix(in srgb, #fb7185 50%, transparent);
  }

  .seal {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.65rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #0b1020;
    background: linear-gradient(135deg, #e6e9f8, #f8f9ff 55%, #c3c8de);
    border: 1px solid rgba(241, 243, 251, 0.75);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  }

  .body {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }
  .name {
    margin: 0;
    font-size: 1.06rem;
    line-height: 1.25;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    margin: 0;
    font-size: 0.78rem;
    color: var(--muted, #94a3b8);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.15rem;
  }
  .bar {
    position: relative;
    flex: 1 1 auto;
    height: 22px;
    min-width: 0;
    border-radius: 999px;
    background: color-mix(in srgb, var(--text, #f1f5f9) 12%, transparent);
    overflow: hidden;
  }
  .bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #7c8dff, #b06ab3);
  }
  .bar-text {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 0 0.5rem;
    font-size: 0.74rem;
    font-weight: 800;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
    font-variant-numeric: tabular-nums;
  }
  .bar-counts {
    flex: none;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text, #f1f5f9);
    font-variant-numeric: tabular-nums;
  }

  .card.platinum {
    border-color: color-mix(in srgb, #cdd0e4 55%, transparent);
    background: linear-gradient(
      160deg,
      color-mix(in srgb, #cdd0e4 11%, var(--surface, #0f1420)) 0%,
      color-mix(in srgb, #cdd0e4 3%, var(--surface, #0f1420)) 55%,
      var(--surface, #0f1420) 100%
    );
  }
  .card.platinum:hover {
    border-color: rgba(205, 208, 228, 0.75);
  }
  .card.platinum .bar-fill {
    background: linear-gradient(90deg, #8b92b3, #b9bed6);
  }

  .footnote {
    margin: 0;
    font-size: 0.75rem;
    color: var(--muted, #64748b);
    text-align: center;
  }

  button {
    touch-action: manipulation;
  }

  @media (prefers-reduced-motion: reduce) {
    .card,
    .filters-toggle,
    .modal-backdrop,
    .modal,
    .modal-close,
    .link-btn,
    .dir-toggle,
    .bar,
    .bar-text {
      transition: none;
    }
    .pulse,
    .sk {
      animation: none;
    }
    .card {
      animation: none;
    }
  }
</style>