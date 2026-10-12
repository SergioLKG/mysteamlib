// Read-only capacity probe (Fase 9, decisions A8-A11 and A13): table sizes,
// user_achievements volume and bytes per user. Only SELECTs; safe to re-run.
// Prints aggregates only (no steam ids, names or secrets), so the output can be
// pasted into the session.
// Usage:
//   node --env-file=.env.local --import tsx scripts/db-capacity.ts
import { sql } from 'drizzle-orm';
import { requireDb } from '../src/lib/db/client';

const NEON_FREE_BYTES = 1024 * 1024 * 1024; // Neon Free storage per project (1 GB)

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function main() {
  const db = requireDb();

  const sizes = await db.execute<{
    table_name: string;
    total_bytes: string;
    table_bytes: string;
    index_bytes: string;
    est_rows: string;
  }>(sql`
    select c.relname as table_name,
           pg_total_relation_size(c.oid) as total_bytes,
           pg_relation_size(c.oid) as table_bytes,
           pg_indexes_size(c.oid) as index_bytes,
           c.reltuples::bigint as est_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by pg_total_relation_size(c.oid) desc
  `);

  const counts = await db.execute<{
    users: string;
    games: string;
    achievements: string;
    user_games: string;
    user_achievements: string;
    user_achievements_unlocked: string;
    games_with_achievements: string;
  }>(sql`
    select
      (select count(*) from users) as users,
      (select count(*) from games) as games,
      (select count(*) from achievements) as achievements,
      (select count(*) from user_games) as user_games,
      (select count(*) from user_achievements) as user_achievements,
      (select count(*) from user_achievements where unlocked) as user_achievements_unlocked,
      (select count(*) from games where has_achievements) as games_with_achievements
  `);

  const perUser = await db.execute<{
    user_achievements: string;
    unlocked: string;
    user_games: string;
  }>(sql`
    select (select count(*) from user_achievements ua where ua.user_id = u.id) as user_achievements,
           (select count(*) from user_achievements ua where ua.user_id = u.id and ua.unlocked) as unlocked,
           (select count(*) from user_games ug where ug.user_id = u.id) as user_games
    from users u
  `);

  const dbSize = await db.execute<{ bytes: string }>(sql`select pg_database_size(current_database()) as bytes`);

  console.log('== Table sizes (public) ==');
  console.log('table\ttotal_MB\ttable_MB\tindex_MB\test_rows');
  for (const r of sizes.rows) {
    console.log(
      `${r.table_name}\t${mb(Number(r.total_bytes))}\t${mb(Number(r.table_bytes))}\t${mb(Number(r.index_bytes))}\t${r.est_rows}`,
    );
  }

  const c = counts.rows[0];
  console.log('\n== Row counts ==');
  console.log(JSON.stringify(c));

  const nUsers = Number(c.users);
  const uaBytes = Number(sizes.rows.find((r) => r.table_name === 'user_achievements')?.total_bytes ?? 0);
  const uaRows = Number(c.user_achievements);
  console.log('\n== user_achievements ==');
  console.log(`bytes per row (incl. indexes): ${uaRows ? (uaBytes / uaRows).toFixed(1) : 'n/a'}`);
  console.log(`bytes per user (avg, incl. indexes): ${nUsers ? Math.round(uaBytes / nUsers) : 'n/a'}`);
  console.log(`unlocked ratio: ${uaRows ? (Number(c.user_achievements_unlocked) / uaRows).toFixed(3) : 'n/a'}`);
  console.log('per user (user_games / user_achievements / unlocked):');
  perUser.rows.forEach((r, i) => console.log(`  #${i + 1}: ${r.user_games} / ${r.user_achievements} / ${r.unlocked}`));

  const total = Number(dbSize.rows[0].bytes);
  console.log('\n== Database ==');
  console.log(`total: ${mb(total)} MB (${((total / NEON_FREE_BYTES) * 100).toFixed(1)} % of ${mb(NEON_FREE_BYTES)} MB)`);
  if (nUsers && uaBytes) {
    const avg = uaBytes / nUsers;
    console.log(`projection: ~${Math.floor((NEON_FREE_BYTES - total) / avg)} more users at the current avg user_achievements cost`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
