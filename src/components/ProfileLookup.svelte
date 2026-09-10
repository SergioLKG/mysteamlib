<script lang="ts">
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

  const ctaHref = user ? '/dashboard' : '/api/auth/login?next=/dashboard';

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
        throw new Error((data as LookupErr).error ?? 'No he podido leer ese perfil.');
      }
      result = data;
      phase = 'done';
    } catch (err) {
      error = err instanceof Error ? err.message : 'No he podido leer ese perfil.';
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
      <span class="hint">URL completa, tu nick de vanity o el SteamID64</span>
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
                Ver perfil en Steam ↗
              </a>
            </div>
          </div>

          <dl class="stat-tiles">
            <div class="tile">
              <dt>Juegos</dt>
              <dd>{result.gamesCount ?? '—'}</dd>
            </div>
            <div class="tile">
              <dt>Horas jugadas</dt>
              <dd>{result.totalHours !== undefined ? formatHours(result.totalHours) : '—'}</dd>
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
            <p class="lookup-msg">No he encontrado horas jugadas en este perfil.</p>
          {/if}
        </div>

        <div class="cta-box">
          <p>
            <strong>Esto es solo el aperitivo.</strong> Con tu cuenta verás el estado de cada logro,
            tu progreso por juego y —sobre todo— <em>el próximo que te conviene platinar</em>.
          </p>
          {#if user}
            <a class="steam-sign-in" href={ctaHref}>Ir a mi dashboard</a>
          {:else}
            <a class="steam-sign-in" href={ctaHref} title="Iniciar sesión con Steam">
              <img
                src="https://community.fastly.steamstatic.com/public/images/signinthroughsteam/sits_01.png"
                alt="Sign in through Steam"
                width="180"
                height="35"
              />
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
                Ver perfil en Steam ↗
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
    gap: 1rem;
  }
  .idle-form {
    display: grid;
    gap: 0.55rem;
  }
  .field-label {
    display: grid;
    gap: 0.2rem;
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--text, #f1f5f9);
  }
  .hint {
    font-size: 0.78rem;
    font-weight: 400;
    color: var(--muted, #94a3b8);
  }
  .field-row {
    display: flex;
    gap: 0.5rem;
  }
  .lookup-input {
    flex: 1;
    min-width: 0;
    padding: 0.7rem 0.9rem;
    border-radius: 12px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.28));
    background: rgba(10, 14, 23, 0.55);
    color: var(--text, #f1f5f9);
    font-size: 0.9rem;
  }
  .lookup-input:focus {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 1px;
  }
  .lookup-input::placeholder {
    color: rgba(148, 163, 184, 0.6);
  }
  .lookup-btn {
    flex: none;
    padding: 0.7rem 1.1rem;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #7c8dff, #b06ab3);
    color: #0a0e17;
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  .lookup-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(124, 141, 255, 0.35);
  }
  .lookup-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  .lookup-btn:focus-visible {
    outline: 2px solid var(--accent-2, #b06ab3);
    outline-offset: 2px;
  }

  .result-region {
    min-height: 8rem;
  }

  .profile-card {
    display: grid;
    gap: 1rem;
    padding: 1.1rem;
    border-radius: 16px;
    background: rgba(17, 23, 36, 0.8);
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
  }
  .who {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .avatar {
    border-radius: 14px;
    width: 64px;
    height: 64px;
    box-shadow: 0 0 0 2px rgba(124, 141, 255, 0.5);
  }
  .who-info {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
  }
  .persona {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .steam-link {
    font-size: 0.8rem;
    color: var(--accent, #7c8dff);
    text-decoration: none;
  }
  .steam-link:hover {
    text-decoration: underline;
  }

  .stat-tiles {
    margin: 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .tile {
    padding: 0.85rem 1rem;
    border-radius: 14px;
    background: linear-gradient(160deg, rgba(124, 141, 255, 0.16), rgba(176, 106, 179, 0.1));
    border: 1px solid rgba(124, 141, 255, 0.35);
  }
  .tile dt {
    margin: 0 0 0.2rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted, #cbd5e1);
  }
  .tile dd {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .list-title {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted, #94a3b8);
  }
  .top-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.4rem;
  }
  .top-list li {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    font-size: 0.88rem;
    padding: 0.35rem 0.5rem;
    border-radius: 10px;
    background: rgba(10, 14, 23, 0.4);
  }
  .rank {
    flex: none;
    width: 1.3rem;
    text-align: center;
    color: var(--accent, #7c8dff);
    font-weight: 700;
  }
  .tname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thours {
    flex: none;
    color: var(--muted, #94a3b8);
    font-variant-numeric: tabular-nums;
  }

  .cta-box {
    display: grid;
    gap: 0.85rem;
    padding: 1rem 1.1rem;
    border-radius: 16px;
    border: 1px dashed rgba(124, 141, 255, 0.4);
    background: rgba(124, 141, 255, 0.06);
  }
  .cta-box p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.55;
    color: var(--muted, #cbd5e1);
  }
  .cta-box strong {
    color: var(--text, #f1f5f9);
  }
  .steam-sign-in {
    display: inline-block;
    line-height: 0;
    border-radius: 4px;
    justify-self: start;
  }
  .steam-sign-in img {
    display: block;
  }

  .lookup-msg {
    margin: 0;
    padding: 0.7rem 0.9rem;
    border-radius: 12px;
    border: 1px dashed var(--border, rgba(148, 163, 184, 0.3));
    color: var(--muted, #94a3b8);
    font-size: 0.88rem;
    line-height: 1.55;
  }
  .lookup-msg strong {
    color: var(--text, #f1f5f9);
  }
  .error-msg {
    border-color: rgba(248, 113, 113, 0.45);
    color: #fca5a5;
  }

  /* ------ skeleton ------ */
  .skeleton {
    display: grid;
    gap: 0.9rem;
    padding: 1.1rem;
    border-radius: 16px;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
  }
  .sk-row {
    display: flex;
    align-items: center;
    gap: 0.85rem;
  }
  .sk-avatar {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background: var(--shimmer, rgba(124, 141, 255, 0.18));
  }
  .sk-line {
    height: 0.8rem;
    border-radius: 6px;
    background: var(--shimmer, rgba(124, 141, 255, 0.18));
  }
  .w70 { width: 70%; }
  .w40 { width: 40%; }
  .sk-tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .sk-tile {
    height: 3.6rem;
    border-radius: 14px;
    background: var(--shimmer, rgba(124, 141, 255, 0.14));
  }
  .sk-list {
    display: grid;
    gap: 0.4rem;
  }

  @keyframes shimmer {
    0% { opacity: 0.55; }
    50% { opacity: 1; }
    100% { opacity: 0.55; }
  }
  .skeleton :is(.sk-avatar, .sk-line, .sk-tile) {
    animation: shimmer 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton :is(.sk-avatar, .sk-line, .sk-tile),
    .lookup-btn {
      animation: none;
      transition: none;
    }
  }

  @media (max-width: 520px) {
    .field-row {
      flex-direction: column;
    }
    .lookup-btn {
      width: 100%;
    }
  }
</style>