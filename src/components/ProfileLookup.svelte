<script lang="ts">
  import Icon from './Icon.svelte';

  interface TopGame {
    appid: number;
    name: string;
    hours: number;
  }

  interface LookupOk {
    ok: true;
    steamId: string;
    personaName: string;
    avatarUrl: string | null;
    profileUrl: string;
    visibility: 'public' | 'private' | 'unreadable';
    gamesCount?: number;
    totalHours?: number;
    topGames?: TopGame[];
  }

  interface LookupErr {
    ok: false;
    error: string;
  }

  let { user = false }: { user?: boolean } = $props();

  let input = $state('');
  let phase = $state<'idle' | 'loading' | 'done'>('idle');
  let result = $state<LookupOk | null>(null);
  let error = $state<string | null>(null);

  const ctaHref = $derived(user ? '/dashboard' : '/api/auth/login?next=/dashboard');

  async function lookup(e: SubmitEvent) {
    e.preventDefault();
    if (!input.trim() || phase === 'loading') return;
    phase = 'loading';
    error = null;
    try {
      const res = await fetch('/api/profiles/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = (await res.json()) as LookupOk | LookupErr;
      if (!res.ok || !data.ok) {
        throw new Error((data as LookupErr).error ?? 'No se pudo leer ese perfil.');
      }
      result = data;
      phase = 'done';
    } catch (err) {
      error = err instanceof Error ? err.message : 'No se pudo leer ese perfil.';
      phase = 'done';
      result = null;
    }
  }

  function formatHours(h: number): string {
    return `${h < 0.05 ? '<0.1' : h} h`;
  }
</script>

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
      <button
        class="lookup-btn"
        type="submit"
        disabled={!input.trim() || phase === 'loading'}
      >
        {phase === 'loading' ? 'Leyendo…' : 'Ver resumen'}
      </button>
    </div>
  </form>

  <div class="result-region" aria-live="polite" aria-busy={phase === 'loading'}>
    {#if phase === 'loading'}
      <div class="skeleton" aria-label="Leyendo tu perfil público de Steam…">
        <div class="sk-row">
          <div class="sk-avatar"></div>
          <div><div class="sk-line w70"></div><div class="sk-line w40"></div></div>
        </div>
        <div class="sk-tiles">
          <div class="sk-tile"></div><div class="sk-tile"></div>
        </div>
        <div class="sk-list"><div class="sk-line"></div><div class="sk-line"></div></div>
      </div>

    {:else if error}
      <p class="lookup-msg error-msg">{error}</p>

    {:else if result?.ok}
      {#if result.visibility === 'public'}
        <div class="profile-card">
          <div class="who">
            {#if result.avatarUrl}
              <img class="avatar" src={result.avatarUrl} alt="" width="64" height="64" />
            {/if}
            <div class="who-info">
              <p class="persona">{result.personaName}</p>
              <a class="steam-link" href={result.profileUrl} target="_blank" rel="noopener noreferrer">
                Ver perfil en Steam
                <Icon name="external-link" size={14} />
                <span class="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>

          <dl class="stat-tiles">
            <div class="tile">
              <dt>Juegos</dt>
              <dd>{result.gamesCount ?? 'Sin dato'}</dd>
            </div>
            <div class="tile">
              <dt>Horas jugadas</dt>
              <dd>{result.totalHours !== undefined ? formatHours(result.totalHours) : 'Sin dato'}</dd>
            </div>
          </dl>

          {#if result.topGames && result.topGames.length > 0}
            <p class="list-title">Tus tops por horas</p>
            <ol class="top-list">
              {#each result.topGames as g, i}
                <li>
                  <span class="rank">{i + 1}</span>
                  <span class="tname">{g.name}</span>
                  <span class="thours">{formatHours(g.hours)}</span>
                </li>
              {/each}
            </ol>
          {:else}
            <p class="lookup-msg">Este perfil no tiene horas jugadas.</p>
          {/if}
        </div>

        <div class="cta-box">
          <p>
            <strong>Esto es solo el aperitivo.</strong> Con tu cuenta ves el estado de cada logro y
            qué juego conviene platinar primero.
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

      {:else if result.visibility === 'private'}
        <div class="profile-card">
          <div class="who">
            {#if result.avatarUrl}
              <img class="avatar" src={result.avatarUrl} alt="" width="64" height="64" />
            {/if}
            <div class="who-info">
              <p class="persona">{result.personaName}</p>
              <a class="steam-link" href={result.profileUrl} target="_blank" rel="noopener noreferrer">
                Ver perfil en Steam
                <Icon name="external-link" size={14} />
                <span class="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </div>
          </div>
          <p class="lookup-msg">
            Este perfil es <strong>privado</strong>: Steam no deja leer sus datos. Abre tu
            privacidad («Perfil de juego» → siempre público) en la configuración de tu cuenta y vuelve.
          </p>
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

  .stat-tiles {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .tile {
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .tile dt {
    margin: 0 0 var(--space-1);
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--color-text-muted);
  }
  .tile dd {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--weight-display);
    font-variant-numeric: tabular-nums;
    letter-spacing: var(--tracking-display);
    color: var(--color-text);
  }

  .list-title {
    margin: var(--space-1) 0 0;
    font-size: var(--text-xs);
    font-weight: var(--weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--tracking-eyebrow);
    color: var(--color-text-muted);
  }
  .top-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
  }
  .top-list li {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
    font-size: var(--text-sm);
    padding: var(--space-2) 0;
    border-block-end: 1px solid var(--color-border);
  }
  .top-list li:last-child {
    border-block-end: 0;
  }
  .rank {
    flex: none;
    width: 1.3rem;
    text-align: center;
    color: var(--color-accent-text);
    font-weight: var(--weight-bold);
  }
  .tname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text);
  }
  .thours {
    flex: none;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .cta-box {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-border);
    background: var(--color-accent-soft);
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
  .sk-tiles {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
  .sk-tile {
    height: 3.6rem;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
  }
  .sk-list {
    display: grid;
    gap: var(--space-2);
  }

  @keyframes shimmer {
    0% { opacity: 0.55; }
    50% { opacity: 1; }
    100% { opacity: 0.55; }
  }
  .skeleton :is(.sk-avatar, .sk-line, .sk-tile) {
    animation: shimmer 1.4s var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton :is(.sk-avatar, .sk-line, .sk-tile) {
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
    .profile-card {
      padding: var(--space-4);
    }
  }
</style>
