// Dev tool: exercise the Fase 3 query against the real DB and print a sample
// of results + a few filter/sort combinations so changes are verifiable locally.
// Usage: node --env-file=.env.local --import tsx scripts/check-platinum.ts [steamId]
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db/client';
import { users } from '../src/lib/db/schema';
import { getLibraryGenres, getPlatinumCandidates } from '../src/lib/db/queries/library';

async function main() {
  if (!db) throw new Error('DATABASE_URL not configured');

  const steamIdArg = process.argv[2];
  const user = steamIdArg
    ? await db.select({ id: users.id, steamId: users.steamId }).from(users).where(eq(users.steamId, steamIdArg)).limit(1)
    : await db.select({ id: users.id, steamId: users.steamId }).from(users).orderBy(users.createdAt).limit(1);
  if (!user[0]) throw new Error('No user found');

  console.log(`user: ${user[0].steamId}`);

  const [genres, rows] = await Promise.all([
    getLibraryGenres(user[0].id),
    getPlatinumCandidates(user[0].id, {}, { key: 'difficulty' }),
  ]);

  console.log(`genres (${genres.length}): ${genres.slice(0, 25).join(', ')}`);
  console.log(`candidates (difficulty asc): ${rows.length}`);
  for (const r of rows.slice(0, 12)) {
    const difficulty = Number(r.difficultyScore).toFixed(2);
    console.log(
      `${difficulty.padEnd(6)} rem=${String(r.achievementsRemaining).padStart(3)} ` +
        `pct=${String(r.completionPercent).padStart(5)} time=${String(r.estimatedTimeToPlatinum ?? 'null').padStart(6)} ` +
        `rarity=${String(r.avgGlobalRarityRemaining === null ? 'null' : r.avgGlobalRarityRemaining.toFixed(1)).padStart(6)} ${r.name}`,
    );
  }

  const started = await getPlatinumCandidates(user[0].id, { state: 'started' }, { key: 'remaining', direction: 'asc' });
  console.log(`\nstarted, by remaining asc (${started.length}):`);
  for (const r of started.slice(0, 5)) {
    console.log(`  ${r.achievementsRemaining}/${r.totalAchievements} unlocked=${r.achievementsUnlocked} ${r.name}`);
  }

  const timed = await getPlatinumCandidates(user[0].id, {}, { key: 'time', direction: 'desc' });
  const last = timed[timed.length - 1];
  console.log('\ntime desc:');
  console.log(`  first=${timed[0]?.name} (${timed[0]?.estimatedTimeToPlatinum}h)`);
  console.log(`  last=${last?.name} (time=${last?.estimatedTimeToPlatinum}, hasTime=${last?.hasTimeEstimate})`);
  const noTime = timed.filter((c) => c.estimatedTimeToPlatinum === null).length;
  console.log(`  null-time games sorted last: ${noTime}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});