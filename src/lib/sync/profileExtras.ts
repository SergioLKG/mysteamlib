import { getPlayerSummaries, getSteamLevel, type PlayerSummary } from '../steam/webApi';
import './steamBudget';

export interface ProfileExtras {
  steamLevel: number | null;
  steamCreatedAt: Date | null;
}

/**
 * Steam level and account creation date for a profile. Both only exist on
 * public profiles, so a private one returns nulls without spending a call.
 * Returns `null` when the level call fails: unknown is not the same as
 * absent, so callers must keep what they already stored. Never throws, the
 * card data must not break login, lookup or sync.
 */
export async function getProfileExtras(player: PlayerSummary): Promise<ProfileExtras | null> {
  if (player.communityvisibilitystate !== 3) return { steamLevel: null, steamCreatedAt: null };
  try {
    const res = await getSteamLevel(player.steamid);
    return {
      steamLevel: res.response?.player_level ?? null,
      steamCreatedAt: player.timecreated ? new Date(player.timecreated * 1000) : null,
    };
  } catch (e) {
    console.error('getSteamLevel failed', e);
    return null;
  }
}

/** Same as `getProfileExtras` for sync jobs that have no summary at hand (+1 call). */
export async function fetchProfileExtras(steamId: string): Promise<ProfileExtras | null> {
  try {
    const player = (await getPlayerSummaries([steamId])).response?.players?.[0];
    return player ? await getProfileExtras(player) : null;
  } catch (e) {
    console.error('getPlayerSummaries failed', e);
    return null;
  }
}
