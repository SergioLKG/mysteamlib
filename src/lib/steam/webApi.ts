const STEAM_API_BASE = 'https://api.steampowered.com';

const API_KEY = process.env.STEAM_API_KEY;

interface SteamApiParams {
  [key: string]: string | number | undefined;
}

/**
 * Hook awaited before every outgoing Steam request. `lib/steam` must not touch
 * the DB, so the daily call counter (`lib/sync/steamBudget.ts`) registers
 * itself here. It may throw `SteamRateLimitError` to refuse the call.
 */
type SteamCallGuard = () => Promise<void>;
let callGuard: SteamCallGuard | null = null;

export function setSteamCallGuard(guard: SteamCallGuard | null): void {
  callGuard = guard;
}

function getApiKey(): string {
  if (!API_KEY) {
    throw new Error('STEAM_API_KEY is not configured');
  }
  return API_KEY;
}

async function steamRequest<T>(
  interfaceName: string,
  method: string,
  version: string,
  params: SteamApiParams = {},
): Promise<T> {
  const url = new URL(
    `${STEAM_API_BASE}/${interfaceName}/${method}/${version}/`,
  );
  url.searchParams.set('key', getApiKey());
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) {
      url.searchParams.set(k, String(v));
    }
  }

  if (callGuard) await callGuard();
  const res = await fetch(url);
  if (!res.ok) {
    // Steam returns 429 or x-eresult 25/84 when rate limited
    if (res.status === 429) {
      throw new SteamRateLimitError(`Steam API rate limited: ${res.status}`);
    }
    // An expired or invalid STEAM_API_KEY is our misconfiguration, not Steam being busy.
    if (res.status === 401) {
      throw new SteamAuthError(`Steam API rejected the key: ${interfaceName}/${method} ${res.status}`);
    }
    throw new Error(`Steam API ${interfaceName}/${method} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export class SteamRateLimitError extends Error {}
export class SteamAuthError extends Error {}

// --- Response types ---

export interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  playtime_windows_forever?: number;
  playtime_linux_forever?: number;
  playtime_mac_forever?: number;
  rtime_last_played?: number;
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
}

export interface GetOwnedGamesResponse {
  response: {
    game_count: number;
    games?: OwnedGame[];
  };
}

export interface PlayerAchievement {
  apiname?: string;
  achieved: number;
  unlocktime?: number;
  name?: string;
  description?: string;
}

export interface GetPlayerAchievementsResponse {
  playerstats?: {
    steamID: string;
    gameName: string;
    achievements?: PlayerAchievement[];
    success: boolean;
    error?: string;
  };
}

export interface SteamAchievementDef {
  name: string;
  defaultvalue?: number;
  displayName?: string;
  hidden?: number;
  description?: string;
  icon?: string;
  icongray?: string;
}

export interface GetSchemaForGameResponse {
  game?: {
    gameName?: string;
    gameVersion?: string;
    availableGameStats?: {
      achievements?: SteamAchievementDef[];
      stats?: unknown[];
    };
  };
}

export interface GlobalAchievementPercent {
  name: string;
  percent: number;
}

export interface GetGlobalAchievementPercentagesResponse {
  achievementpercentages?: {
    achievements?: GlobalAchievementPercent[];
  };
}

export interface PlayerSummary {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
  communityvisibilitystate?: number;
  profileurl?: string;
  /** Unix seconds of Steam account creation. Only present on public profiles. */
  timecreated?: number;
}

export interface GetSteamLevelResponse {
  response?: {
    player_level?: number;
  };
}

export interface GetPlayerSummariesResponse {
  response?: {
    players?: PlayerSummary[];
  };
}

export interface ResolveVanityURLResponse {
  response?: {
    success: number;
    steamid?: string;
    message?: string;
  };
}

// --- Methods ---

export function getOwnedGames(
  steamId: string,
  opts: { includePlayedFreeGames?: boolean } = {},
): Promise<GetOwnedGamesResponse> {
  return steamRequest<GetOwnedGamesResponse>('IPlayerService', 'GetOwnedGames', 'v1', {
    steamid: steamId,
    include_appinfo: 1,
    include_played_free_games: opts.includePlayedFreeGames ? 1 : 0,
    format: 'json',
  });
}

export function getPlayerAchievements(
  steamId: string,
  appid: number,
): Promise<GetPlayerAchievementsResponse> {
  return steamRequest<GetPlayerAchievementsResponse>(
    'ISteamUserStats',
    'GetPlayerAchievements',
    'v1',
    { steamid: steamId, appid },
  );
}

export function getSchemaForGame(appid: number): Promise<GetSchemaForGameResponse> {
  return steamRequest<GetSchemaForGameResponse>(
    'ISteamUserStats',
    'GetSchemaForGame',
    'v2',
    { appid },
  );
}

export function getGlobalAchievementPercentagesForApp(
  appid: number,
): Promise<GetGlobalAchievementPercentagesResponse> {
  return steamRequest<GetGlobalAchievementPercentagesResponse>(
    'ISteamUserStats',
    'GetGlobalAchievementPercentagesForApp',
    'v2',
    { gameid: appid },
  );
}

export function getPlayerSummaries(steamIds: string[]): Promise<GetPlayerSummariesResponse> {
  // Array params use zero-based index postfix, max 100 steamids per call
  const params: SteamApiParams = { steamids: steamIds.join(',') };
  return steamRequest<GetPlayerSummariesResponse>(
    'ISteamUser',
    'GetPlayerSummaries',
    'v2',
    params,
  );
}

export function getSteamLevel(steamId: string): Promise<GetSteamLevelResponse> {
  return steamRequest<GetSteamLevelResponse>('IPlayerService', 'GetSteamLevel', 'v1', {
    steamid: steamId,
  });
}

export function resolveVanityUrl(vanity: string): Promise<ResolveVanityURLResponse> {
  return steamRequest<ResolveVanityURLResponse>('ISteamUser', 'ResolveVanityURL', 'v1', {
    vanityurl: vanity,
  });
}
