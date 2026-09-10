<script lang="ts">
  interface Chunk {
    mode: string;
    done: boolean;
    totalPending: number;
    processed: number;
    remainingPending: number;
  }

  const ALLOWED_DEST = ['/dashboard', '/platino'];

  let { from = '/dashboard' }: { from?: string } = $props();

  const dest = $derived(ALLOWED_DEST.includes(from) ? from : '/dashboard');

  let phase = $state<'connecting' | 'importing' | 'finalizing' | 'done'>('connecting');
  let error = $state<string | null>(null);
  let total = $state(0);
  let processed = $state(0);
  let running = $state(false);
  let finishedMsg = $state('');

  const pct = $derived(
    phase === 'connecting' || total === 0 ? 0 : Math.min(100, Math.round((processed / total) * 100)),
  );

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    error = null;
    phase = 'connecting';

    try {
      while (true) {
        const res = await fetch('/api/sync/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Chunk;
        if ((data as { error?: string }).error) throw new Error((data as { error?: string }).error);

        if (phase === 'connecting') {
          phase = 'importing';
          total = data.totalPending;
        }
        processed += data.processed;
        if (data.done) break;
      }

      phase = 'finalizing';
      finishedMsg =
        total > 0
          ? `Listo: ${processed} ${processed === 1 ? 'juego' : 'juegos'} de tu biblioteca importados.`
          : 'Tu biblioteca está vacía. ¡A por tu primer juego!';
      await sleep(900);
      phase = 'done';
      running = false;

      // Short pause so the success state is visible before landing.
      await sleep(700);
      window.location.href = dest;
    } catch (e) {
      phase = 'connecting';
      running = false;
      error = (e as Error).message;
    }
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  function stepState(idx: number): string {
    if (error) return idx === 0 ? 'active' : 'todo';
    if (phase === 'connecting') return idx === 0 ? 'active' : 'todo';
    if (phase === 'importing') return idx === 1 ? 'active' : idx < 1 ? 'done' : 'todo';
    if (phase === 'finalizing') return idx < 2 ? 'done' : 'active';
    return 'done';
  }

  const steps = [
    'Conectando con tu cuenta de Steam',
    'Importando tu biblioteca y tus logros',
    'Poniendo todo en orden',
  ];
</script>

<div class="pasarela">
  <div class="stage" role="status" aria-live="polite" aria-busy={!error && phase !== 'done'}>
    <div class="ring-wrap" class:done={phase === 'done'}>
      <div class="ring" style:--pct={pct}></div>
      <div class="ring-core">
        {#if phase === 'done'}
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        {:else}
          <span class="pct-num">{pct}%</span>
        {/if}
      </div>
    </div>

    <h1 class="title">Preparando tu biblioteca</h1>
    <p class="lede">
      Estoy trayendo tus juegos y logros desde Steam. Esto solo pasa la primera
      vez: si tienes cientos de juegos, puede tardar un ratito.
    </p>

    <div class="status-line">
      {#if error}
        <span class="status-err">Algo se rompió importando tus datos: {error}</span>
      {:else if phase === 'done'}
        <span class="status-ok">{finishedMsg} Ya te llevo a tu dashboard.</span>
      {:else if phase === 'importing'}
        <span class="status-now">
          {#if total > 0}
            Procesando <strong>{Math.min(processed, total)}</strong> de <strong>{total}</strong> juegos
          {:else}
            Calculando lo que hay que importar…
          {/if}
        </span>
      {:else}
        <span class="status-now">Obteniendo tu biblioteca desde Steam…</span>
      {/if}
    </div>

    <ol class="steps">
      {#each steps as s, i (s)}
        <li class:done={stepState(i) === 'done'} class:active={stepState(i) === 'active'}>
          <span class="dot" aria-hidden="true">
            {#if stepState(i) === 'done'}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {/if}
          </span>
          {s}
          {#if i === 1 && phase === 'importing' && total > 0}
            <span class="step-count">({Math.min(processed, total)}/{total})</span>
          {/if}
        </li>
      {/each}
    </ol>

    {#if error}
      <button class="retry" type="button" onclick={run}>Reintentar</button>
    {/if}
  </div>
</div>

<style>
  .pasarela {
    display: grid;
    place-items: center;
    min-height: calc(100vh - var(--header-h, 3.875rem));
    padding: 2rem 1.25rem 4rem;
  }
  .stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.9rem;
    width: min(30rem, 100%);
    text-align: center;
  }

  .ring-wrap {
    position: relative;
    margin-bottom: 0.5rem;
  }
  .ring {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, transparent 58%, transparent 59%),
      conic-gradient(
        from 0deg,
        var(--accent, #7c8dff) calc(var(--pct, 0) * 1%),
        rgba(148, 163, 184, 0.18) calc(var(--pct, 0) * 1%)
      );
    animation: breathe 2.1s ease-in-out infinite;
  }
  .ring-core {
    position: absolute;
    inset: 10px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--bg, #0a0e17);
    color: var(--accent, #7c8dff);
  }
  .pct-num {
    font-size: 1.05rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .ring-wrap.done .ring {
    animation: none;
    background: conic-gradient(#4ade80 0 100%);
    box-shadow: 0 0 30px rgba(74, 222, 128, 0.45);
  }
  .ring-wrap.done .ring-core {
    color: #4ade80;
  }

  .title {
    margin: 0;
    font-size: clamp(1.5rem, 4vw, 2rem);
    letter-spacing: -0.02em;
    text-wrap: balance;
    background: linear-gradient(90deg, #a5b4fc, #e0a3e3);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .lede {
    margin: 0;
    color: var(--muted, #94a3b8);
    line-height: 1.55;
    text-wrap: pretty;
  }

  .status-line {
    font-size: 0.92rem;
  }
  .status-now strong {
    font-variant-numeric: tabular-nums;
  }
  .status-ok {
    color: #4ade80;
  }
  .status-err {
    color: #fb7185;
  }

  .steps {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    gap: 0.55rem;
    width: 100%;
    text-align: left;
  }
  .steps li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.9rem;
    color: var(--muted, #94a3b8);
  }
  .steps li.active {
    color: var(--text, #f1f5f9);
  }
  .steps li.done {
    color: var(--muted, #94a3b8);
  }
  .dot {
    flex: none;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--border, rgba(148, 163, 184, 0.3));
    background: color-mix(in srgb, var(--surface, #0f1420) 70%, #000);
  }
  .steps li.active .dot {
    border-color: var(--accent, #7c8dff);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #7c8dff) 22%, transparent);
  }
  .steps li.done .dot {
    border-color: transparent;
    background: linear-gradient(135deg, #7c8dff, #b06ab3);
    color: #fff;
  }
  .step-count {
    font-variant-numeric: tabular-nums;
  }

  .retry {
    font: inherit;
    font-weight: 700;
    font-size: 0.9rem;
    padding: 0.6rem 1.4rem;
    border-radius: 10px;
    border: 1px solid var(--accent, #7c8dff);
    background: color-mix(in srgb, var(--accent, #7c8dff) 14%, transparent);
    color: var(--text, #f1f5f9);
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.15s ease;
  }
  .retry:hover {
    filter: brightness(1.12);
  }
  .retry:focus-visible {
    outline: 2px solid var(--accent, #7c8dff);
    outline-offset: 2px;
  }

  button {
    touch-action: manipulation;
  }

  @keyframes breathe {
    0%,
    100% {
      filter: brightness(1);
      transform: scale(1);
    }
    50% {
      filter: brightness(1.12);
      transform: scale(1.03);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring,
    .ring-wrap.done .ring {
      animation: none;
      transition: none;
    }
  }
</style>