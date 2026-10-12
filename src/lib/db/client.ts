import { neon } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

export type Db = NeonHttpDatabase<typeof schema>;

const connectionString = process.env.DATABASE_URL;

const sql = connectionString ? neon(connectionString) : null;

export const db: Db | null = sql ? drizzle(sql, { schema }) : null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('Database not configured');
    this.name = 'DatabaseNotConfiguredError';
  }
}

/** Non-null `db`; throws `DatabaseNotConfiguredError` when `DATABASE_URL` is unset. */
export function requireDb(): Db {
  if (!db) throw new DatabaseNotConfiguredError();
  return db;
}
