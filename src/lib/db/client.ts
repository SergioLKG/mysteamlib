import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
neonConfig.fetchConnectionCache = true;

const sql = connectionString ? neon(connectionString) : null;

export const db: NeonHttpDatabase<typeof schema> | null = sql
  ? drizzle(sql, { schema })
  : null;
