// One-time backfill (Fase 3): the daily library sync skips games whose
// `library_synced_at` is already set, so the change that populates
// `user_achievements` would never reach existing games on its own. This runs a
// forced library sync so every game re-fetches its achievement list and stores
// per-user unlock state (avg_global_rarity_remaining depends on it).
// Idempotent and safely re-runnable.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-user-achievements.ts [steamId]
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db/client';
import { users } from '../src/lib/db/schema';
import { syncLibrary } from '../src/lib/sync/syncLibrary';

async function main() {
  if (!db) throw new Error('DATABASE_URL not configured');

  const steamIdArg = process.argv[2];
  const user = steamIdArg
    ? await db
        .select({ id: users.id, steamId: users.steamId })
        .from(users)
        .where(eq(users.steamId, steamIdArg))
        .limit(1)
    : await db
        .select({ id: users.id, steamId: users.steamId })
        .from(users)
        .orderBy(users.createdAt)
        .limit(1);
  if (!user[0]) throw new Error('No user found');

  console.log(`Backfilling user_achievements for ${user[0].steamId} (force library sync)...`);
  const result = await syncLibrary(user[0].id, { force: true });
  console.log('[backfill-user-achievements]', JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });