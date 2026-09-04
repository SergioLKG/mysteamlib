const STORE_API_BASE = 'https://store.steampowered.com/api/appdetails';

export interface StoreAppData {
  appid: number;
  name?: string;
  release_date?: { coming_soon: boolean; date: string };
  header_image?: string;
  genres?: { id: number; description: string }[];
  // SteamStore data success flag
}

export interface StoreAppDetailsResponse {
  [appid: string]: {
    success: boolean;
    data?: StoreAppData;
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch appdetails from the Steam Store API for a single appid.
 * The Store API has no documented rate limit and is treated as fragile.
 * Uses exponential backoff on 429 responses.
 */
export async function getStoreAppDetails(
  appid: number,
  opts: { maxRetries?: number } = {},
): Promise<StoreAppDetailsResponse[string] | null> {
  const maxRetries = opts.maxRetries ?? 3;
  const url = new URL(STORE_API_BASE);
  url.searchParams.set('appids', String(appid));
  url.searchParams.set('filters', 'basic,genres,release_date');

  let attempt = 0;
  while (true) {
    const res = await fetch(url);
    if (res.status === 429) {
      attempt += 1;
      if (attempt > maxRetries) {
        throw new Error(`Steam Store API rate limited after ${maxRetries} retries`);
      }
      const waitMs = 2 ** attempt * 500;
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Steam Store API failed: ${res.status}`);
    }
    const json = (await res.json()) as StoreAppDetailsResponse;
    return json[String(appid)] ?? null;
  }
}
