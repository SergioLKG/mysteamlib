import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `webApi` reads STEAM_API_KEY at import time, so it is imported after stubbing.
async function loadWebApi() {
  vi.resetModules();
  vi.stubEnv('STEAM_API_KEY', 'test-key');
  return import('../src/lib/steam/webApi');
}

function stubFetch(status: number) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })));
}

describe('steamRequest error mapping', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('maps 401 (bad key) to SteamAuthError, not a rate limit', async () => {
    const api = await loadWebApi();
    stubFetch(401);
    const err = await api.getPlayerSummaries(['1']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(api.SteamAuthError);
    expect(err).not.toBeInstanceOf(api.SteamRateLimitError);
  });

  it('maps 429 to SteamRateLimitError', async () => {
    const api = await loadWebApi();
    stubFetch(429);
    const err = await api.getPlayerSummaries(['1']).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(api.SteamRateLimitError);
  });

  it('keeps other failures as a generic Error', async () => {
    const api = await loadWebApi();
    stubFetch(500);
    const err = await api.getPlayerSummaries(['1']).catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(api.SteamAuthError);
    expect(err).not.toBeInstanceOf(api.SteamRateLimitError);
  });
});
