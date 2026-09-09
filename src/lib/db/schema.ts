import {
  pgTable,
  timestamp,
  text,
  uuid,
  integer,
  boolean,
  date,
  numeric,
  uniqueIndex,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';

// Fase 1: health check table
export const healthCheck = pgTable('health_check', {
  id: uuid('id').defaultRandom().primaryKey(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Fase 2: full schema

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    steamId: text('steam_id').notNull().unique(),
    personaName: text('persona_name'),
    avatarUrl: text('avatar_url'),
    profileVisibility: text('profile_visibility', {
      enum: ['public', 'private'],
    }).default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_steam_id_idx').on(t.steamId)],
);

export const games = pgTable(
  'games',
  {
    appid: integer('appid').primaryKey(),
    name: text('name').notNull(),
    genres: text('genres').array(),
    tags: text('tags').array(),
    releaseDate: date('release_date'),
    headerImageUrl: text('header_image_url'),
    hasAchievements: boolean('has_achievements').default(false).notNull(),
    totalAchievements: integer('total_achievements').default(0).notNull(),
    metadataSyncedAt: timestamp('metadata_synced_at', { withTimezone: true }),
  },
  (t) => [index('games_name_idx').on(t.name)],
);

export const achievements = pgTable(
  'achievements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    appid: integer('appid')
      .notNull()
      .references(() => games.appid, { onDelete: 'cascade' }),
    apiName: text('api_name').notNull(),
    displayName: text('display_name'),
    globalPercent: numeric('global_percent'),
    percentSyncedAt: timestamp('percent_synced_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('achievements_appid_apiname_idx').on(t.appid, t.apiName)],
);

export const userGames = pgTable(
  'user_games',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    appid: integer('appid')
      .notNull()
      .references(() => games.appid, { onDelete: 'cascade' }),
    playtimeMinutes: integer('playtime_minutes').default(0).notNull(),
    playtime2weeksMinutes: integer('playtime_2weeks_minutes'),
    achievementsUnlocked: integer('achievements_unlocked').default(0).notNull(),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    librarySyncedAt: timestamp('library_synced_at', { withTimezone: true }),
    // Non-null = the last library attempt for this game failed (e.g. Steam
    // 403/private profile) and the next daily sync should retry it. Cleared on
    // success. Without this, a transient failure would be final forever.
    librarySyncError: text('library_sync_error'),
  },
  (t) => [
    uniqueIndex('user_games_user_appid_idx').on(t.userId, t.appid),
    index('user_games_user_idx').on(t.userId),
  ],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id, { onDelete: 'cascade' }),
    unlocked: boolean('unlocked').default(false).notNull(),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.achievementId] }),
    index('user_achievements_user_idx').on(t.userId),
    index('user_achievements_achievement_idx').on(t.achievementId),
  ],
);

export const hltbMatches = pgTable('hltb_matches', {
  appid: integer('appid')
    .primaryKey()
    .references(() => games.appid, { onDelete: 'cascade' }),
  hltbId: text('hltb_id'),
  mainStoryHours: numeric('main_story_hours'),
  mainExtraHours: numeric('main_extra_hours'),
  completionistHours: numeric('completionist_hours'),
  matchConfidence: text('match_confidence', {
    enum: ['exact', 'fuzzy', 'manual_override', 'not_found'],
  }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
});
