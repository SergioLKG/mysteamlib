<script lang="ts">
  import Icon from './Icon.svelte';
  import PublicLibrary from './PublicLibrary.svelte';
  import type { ProfileLookupPayload } from '../pages/api/profiles/lookup';
  import type { PublicLibraryPayload } from '../pages/api/profiles/[steamId]/library';

  type Profile = Extract<ProfileLookupPayload, { ok: true }>;
  type Library = Extract<PublicLibraryPayload, { ok: true; visibility: 'public' }>;

  // Bad input, unknown profile or Steam/our own rate limit: nothing the visitor
  // did wrong enough to scare them. Red is only for real failures (5xx, network).
  const SOFT_STATUSES = [400, 404, 429, 503];

  const DEFAULT_ERROR = 'No se pudo leer ese perfil. Reintenta en unos segundos.';
  const LIBRARY_ERROR = 'No se pudo cargar la biblioteca. Reintenta en unos segundos.';

  let { user = false }: { user?: boolean } = $props();

  let input = $state('');
  // idle → loading (profile) → ready | private | notice (soft) | error (red)
  let phase = $state<'idle' | 'loading' | 'ready' | 'private' | 'notice' | 'error'>('idle');
  let message = $state<string | null>(null);
  // Tone of the library error shown under the profile card.
  let messageSoft = $state(false);
  // API responses are only ever reassigned, never mutated: no deep proxy.
  let profile = $state.raw<Profile | null>(null);
  let library = $state.raw<Library | null>(null);
  let libraryStatus = $state<'idle' | 'loading' | 'error'>('idle');

  // Only the latest lookup may write state: a newer submit aborts the older one.
  let controller: AbortController | null = null;

  const ctaHref = $derived(user ? '/dashboard' : '/api/auth/login?next=/dashboard');
  const status = $derived(
    phase === 'loading'
      ? 'Leyendo el perfil de Steam…'
      : phase === 'ready' && library
        ? `Biblioteca cargada: ${library.gamesCount} juegos.`
        : phase === 'private'
          ? 'No se pueden leer los juegos de este perfil.'
          : '',
  );

  async function readJson<T>(res: Response): Promise<T | null> {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async function loadLibrary(steamId: string, signal: AbortSignal) {
    libraryStatus = 'loading';
    try {
      const res = await fetch(`/api/profiles/${steamId}/library`, { signal });
      const data = await readJson<PublicLibraryPayload>(res);
      if (signal.aborted) return;
      if (!data?.ok) {
        message = data?.error ?? LIBRARY_ERROR;
        messageSoft = SOFT_STATUSES.includes(res.status);
        libraryStatus = 'error';
      } else if (data.visibility === 'unreadable') {
        // Public profile page, hidden game details.
        phase = 'private';
        libraryStatus = 'idle';
      } else {
        library = data;
        libraryStatus = 'idle';
      }
    } catch {
      if (signal.aborted) return;
      message = LIBRARY_ERROR;
      messageSoft = false;
      libraryStatus = 'error';
    }
  }

  async function lookup(e: SubmitEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || phase === 'loading') return;

    controller?.abort();
    const mine = new AbortController();
    controller = mine;
    phase = 'loading';
    message = null;
    profile = null;
    library = null;
    libraryStatus = 'idle';

    try {
      const res = await fetch('/api/profiles/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value }),
        signal: mine.signal,
      });
      const data = await readJson<ProfileLookupPayload>(res);
      if (mine.signal.aborted) return;
      if (!data?.ok) {
        message = data?.error ?? DEFAULT_ERROR;
        phase = SOFT_STATUSES.includes(res.status) ? 'notice' : 'error';
        return;
      }
      profile = data;
      if (data.visibility === 'private') {
        phase = 'private';
        return;
      }
      phase = 'ready';
      await loadLibrary(data.steamId, mine.signal);
    } catch {
      if (mine.signal.aborted) return;
      message = DEFAULT_ERROR;
      phase = 'error';
    }
  }

  function retryLibrary() {
    if (profile && controller) loadLibrary(profile.steamId, controller.signal);
  }
</script>

{#snippet who(p: Profile)}
  <div class="who">
    {#if p.avatarUrl}
      <img class="avatar" src={p.avatarUrl} alt="" width="64" height="64" />
    {/if}
    <div class="who-info">
      <p class="persona">{p.personaName}</p>
      <a class="steam-link" href={p.profileUrl} target="_blank" rel="noopener noreferrer">
        Ver perfil en Steam
        <Icon name="external-link" size={14} />
        <span class="sr-only">(se abre en una pestaña nueva)</span>
      </a>
    </div>
  </div>
{/snippet}

<div class="lookup">
  <form class="idle-form" onsubmit={lookup}>
    <label class="field-label" for="profile-input">
      Tu perfil de Steam
      <span class="hint">URL, nick o SteamID64</span>
    </label>
    <div class="field-row">
      <input
        id="profile-input"
        type="text"
        autocomplete="off"
        inputmode="url"
        spellcheck="false"
        placeholder="https://steamcommunity.com/id/tu-nick"
        class="lookup-input"
        bind:value={input}
        disabled={phase === 'loading'}
      />
      <button class="lookup-btn" type="submit" disabled={!input.trim() || phase === 'loading'}>
        {phase === 'loading' ? 'Leyendo…' : 'Ver biblioteca'}
      </button>
    </div>
  </form>

  <p class="sr-only" role="status">{status}</p>

  <div class="result-region" aria-busy={phase === 'loading' || libraryStatus === 'loading'}>
    {#if phase === 'loading'}
      <div class="skeleton" aria-hidden="true">
        <div class="sk-row">
          <div class="sk-avatar"></div>
          <div><div class="sk-line w70"></div><div class="sk-line w40"></div></div>
        </div>
      </div>

    {:else if phase === 'notice'}
      <p class="lookup-msg" role="status">{message}</p>

    {:else if phase === 'error'}
      <p class="lookup-msg error-msg" role="alert">{message}</p>

    {:else if profile && phase === 'private'}
      <div class="profile-card">
        {@render who(profile)}
        <p class="lookup-msg">
          {#if profile.visibility === 'private'}
            Este perfil es <strong>privado</strong>: Steam no deja leer sus datos. Abre tu privacidad
            («Perfil de juego» → siempre público) en la configuración de tu cuenta y vuelve.
          {:else}
            El perfil es público, pero <strong>los detalles del juego están ocultos</strong>. Ponlos
            como públicos en la privacidad de tu cuenta de Steam y vuelve a probar.
          {/if}
        </p>
      </div>

    {:else if profile && phase === 'ready'}
      <div class="profile-card">
        {@render who(profile)}

        {#if library}
          {#key library.steamId}
            <PublicLibrary
              gamesCount={library.gamesCount}
              totalHours={library.totalHours}
              games={library.games}
            />
          {/key}
        {:else if libraryStatus === 'error'}
          <div class="library-error">
            <p class={['lookup-msg', !messageSoft && 'error-msg']} role={messageSoft ? 'status' : 'alert'}>
              {message}
            </p>
            <button type="button" class="retry" onclick={retryLibrary}>Reintentar</button>
          </div>
        {:else}
          <div class="sk-games" aria-hidden="true">
            {#each { length: 6 } as _, i (i)}
              <div class="sk-game"></div>
            {/each}
          </div>
        {/if}
      </div>

      {#if library}
        <div class="cta-box cta-box-home">
          <p>
            <strong>Esto es solo el aperitivo.</strong> Con tu cuenta ves el estado de tus logros, qué juego conviene platinar primero, propositos de año nuevo y mucho más.
          </p>
          {#if user}
            <a class="dash-cta" href={ctaHref}>Ir a mi dashboard</a>
          {:else}
            <a class="dash-cta" href={ctaHref}>
              <Icon name="steam" size={18} />
              Iniciar sesión con Steam
            </a>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .lookup {
    display: grid;
    gap: var(--space-4);
    font-family: var(--font-sans);
    color: var(--color-text-body);
  }
  .idle-form {
    display: grid;
    gap: var(--space-2);
  }
  .field-label {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-3);
    font-size: var(--text-base);
    font-weight: var(--weight-bold);
    color: var(--color-text);
  }
  .hint {
    font-size: var(--text-sm);
    font-weight: var(--weight-regular);
    color: var(--color-text-muted);
  }
  .field-row {
    display: flex;
    gap: var(--space-2);
  }
  .lookup-input {
    flex: 1;
    min-width: 0;
    min-height: 3rem;
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border-strong);
    outline: 2px solid transparent;
    outline-offset: 1px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
    font-size: var(--text-base);
    transition: border-color var(--duration-base) var(--ease-out);
  }
  .lookup-input:hover:not(:disabled) {
    border-color: var(--color-text-muted);
  }
  .lookup-input:focus-visible {
    outline-color: var(--color-focus);
  }
  .lookup-input:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .lookup-input::placeholder {
    color: var(--color-text-muted);
  }
  .lookup-btn {
    flex: none;
    min-height: 3rem;
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    border: 1px solid transparent;
    background: var(--color-accent);
    color: var(--color-on-accent);
    font: inherit;
    font-weight: var(--weight-bold);
    font-size: var(--text-base);
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background-color var(--duration-base) var(--ease-out),
      opacity var(--duration-base) var(--ease-out);
  }
  .lookup-btn:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }
  .lookup-btn:active:not(:disabled) {
    transform: translateY(1px);
  }
  .lookup-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .lookup-btn:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
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

  .result-region {
    min-height: 8rem;
  }

  .profile-card {
    display: grid;
    gap: var(--space-4);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: var(--shadow-card);
  }
  .who {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .avatar {
    border-radius: var(--radius-md);
    width: 64px;
    height: 64px;
    box-shadow: 0 0 0 2px var(--color-accent);
  }
  .who-info {
    display: grid;
    gap: var(--space-1);
    min-width: 0;
  }
  .persona {
    margin: 0;
    font-size: var(--text-lg);
    font-weight: var(--weight-display);
    letter-spacing: var(--tracking-display);
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .steam-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    justify-self: start;
    font-size: var(--text-sm);
    color: var(--color-accent-text);
    text-decoration: none;
  }
  .steam-link:hover {
    text-decoration: underline;
  }
  .steam-link:focus-visible,
  .dash-cta:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 3px;
  }

  .cta-box {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-accent-soft);
  }
  .cta-box-home{
    margin-top: var(--space-4);
  }
  .cta-box p {
    margin: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    color: var(--color-text-body);
  }
  .cta-box strong {
    color: var(--color-text);
  }
  .dash-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    justify-self: start;
    min-height: 2.75rem;
    padding: 0 var(--space-5);
    border-radius: var(--radius-pill);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--weight-bold);
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    transition: background-color var(--duration-base) var(--ease-out);
  }
  .dash-cta:hover {
    background: var(--color-accent-hover);
  }

  .lookup-msg {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
  }
  .lookup-msg strong {
    color: var(--color-text);
  }
  .library-error {
    display: grid;
    gap: var(--space-3);
    justify-items: start;
  }
  .retry {
    min-height: 2.5rem;
    padding: 0 var(--space-4);
    border-radius: var(--radius-pill);
    border: 1px solid var(--color-border-strong);
    background: transparent;
    color: var(--color-text);
    font: inherit;
    font-weight: var(--weight-bold);
    cursor: pointer;
  }
  .retry:hover {
    border-color: var(--color-text-muted);
  }
  .retry:focus-visible {
    outline: 2px solid var(--color-focus);
    outline-offset: 2px;
  }
  .error-msg {
    border-color: var(--color-danger);
    color: var(--color-danger);
  }

  /* ------ skeleton ------ */
  .skeleton {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
  }
  .sk-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .sk-avatar {
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .sk-row > div:last-child {
    flex: 1;
    min-width: 0;
  }
  .sk-line {
    height: 0.8rem;
    margin-block-end: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }
  .w70 { width: 70%; }
  .w40 { width: 40%; }
  .sk-games {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 10.5rem), 1fr));
    gap: var(--space-3);
  }
  .sk-game {
    aspect-ratio: 460 / 215;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
  }

  @keyframes shimmer {
    0% { opacity: 0.55; }
    50% { opacity: 1; }
    100% { opacity: 0.55; }
  }
  :is(.skeleton, .sk-games) :is(.sk-avatar, .sk-line, .sk-game) {
    animation: shimmer 1.4s var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    :is(.skeleton, .sk-games) :is(.sk-avatar, .sk-line, .sk-game) {
      animation: none;
    }
    .lookup-btn,
    .lookup-input,
    .dash-cta {
      transition: none;
    }
    .lookup-btn:active:not(:disabled) {
      transform: none;
    }
  }

  @media (max-width: 520px) {
    .field-row {
      flex-direction: column;
    }
    .lookup-btn {
      width: 100%;
    }
    .profile-card,
    .cta-box {
      padding: var(--space-4);
    }
    .dash-cta {
      padding: 0 var(--space-4);
    }
  }
</style>
