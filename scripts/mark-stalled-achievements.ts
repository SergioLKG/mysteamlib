// One-off heal for the pre-library_sync_error era (Fase 3 migration 0003):
// games whose GetPlayerAchievements never succeeded (e.g. profile was private
// at backfill time) have catalog achievements but ZERO user_achievements rows
// and achievements_unlocked=0. With the new `library_sync_error` column these
// now get auto-retried by the daily cron, but legacy rows predate the column,
// so this flags the ones that are clearly stalled so the next syncLibrary run
// picks them up.
//
// Run from ./app:
//   node --env-file=.env.local --import tsx scripts/mark-stalled-achievements.ts
//
// Follow up with a non-forced sync so only the flagged games are re-fetched:
//   node --env-file=.env.local --import tsx scripts/backfill-user-achievements.ts
// (backfill-user-achievements runs syncLibrary non-force by default.)
import { db } from '../src/lib/db/client';

const user = (await db.execute('select id, steam_id from users limit 1')).rows[0];
if (!user) throw new Error('no user found');

const withRows = (
  await db.execute(
    `select a.appid from user_achievements ua join achievements a on a.id = ua.achievement_id
     where ua.user_id = '${user.id}' group by a.appid`,
  ),
).rows;
const withRowsSet = new Set(withRows.map((r) => r.appid));

const candidates = (
  await db.execute(
    `select ug.appid, g.name from user_games ug join games g on g.appid = ug.appid
     where ug.user_id = '${user.id}' and g.has_achievements and g.total_achievements >= 1
       and ug.achievements_unlocked = 0`,
  ),
).rows;

const stalled = candidates.filter((c) => !withRowsSet.has(c.appid));

console.log(`[mark-stalled] user=${user.steam_id} stalled=${stalled.length}`, stalled.map((s) => `${s.appid} ${s.name}`));

if (stalled.length > 0) {
  await db.execute(
    `update user_games set library_sync_error = 'GetPlayerAchievements: stalled (retry)'
     where user_id = '${user.id}' and appid in (${stalled.map((s) => s.appid).join(',')})`,
  );
  console.log('[mark-stalled] flagged for retry');
}