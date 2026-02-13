import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://shoal:shoal_dev@localhost:5432/shoal';

const pool = new pg.Pool({ connectionString });

export const db = drizzle(pool);
