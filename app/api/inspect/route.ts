import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const results: any = {};

  // 1. Test database-postgresql-fy9a1w
  try {
    const pool = new Pool({
      host: 'database-postgresql-fy9a1w',
      port: 5432,
      user: 'postgres',
      password: 'dNGwXb9OCrJNNaJMoKI7',
      database: 'postgres',
      connectionTimeoutMillis: 3000,
    });
    const dbs = await pool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    results.dokployPostgresDbs = dbs.rows.map((r: any) => r.datname);

    // If keycloak/keycloack exists, check tables
    for (const dbName of ['keycloak', 'keycloack', 'stalwart', 'app', 'oxicloud']) {
      if (results.dokployPostgresDbs.includes(dbName)) {
        try {
          const dbPool = new Pool({
            host: 'database-postgresql-fy9a1w',
            port: 5432,
            user: 'postgres',
            password: 'dNGwXb9OCrJNNaJMoKI7',
            database: dbName,
            connectionTimeoutMillis: 3000,
          });
          const tables = await dbPool.query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 30;"
          );
          results[`tables_${dbName}`] = tables.rows.map((r: any) => r.table_name);
          
          if (tables.rows.some((r: any) => r.table_name.toLowerCase().includes('user'))) {
            const userTable = tables.rows.find((r: any) => r.table_name.toLowerCase().includes('user'))?.table_name;
            const users = await dbPool.query(`SELECT * FROM "${userTable}" LIMIT 10;`);
            results[`sample_users_${dbName}`] = users.rows;
          }
          await dbPool.end();
        } catch (e: any) {
          results[`error_${dbName}`] = e.message;
        }
      }
    }
    await pool.end();
  } catch (err: any) {
    results.dokployPostgresError = err.message;
  }

  // 2. Test ParadeDB
  try {
    const paradePool = new Pool({
      host: 'mail-paradedb-46ygk4-postgres-1',
      port: 5432,
      user: 'postgres',
      password: 'dNGwXb9OCrJNNaJMoKI7',
      database: 'app',
      connectionTimeoutMillis: 3000,
    });
    const paradeDbs = await paradePool.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
    results.paradeDbs = paradeDbs.rows.map((r: any) => r.datname);
    await paradePool.end();
  } catch (err: any) {
    results.paradeError = err.message;
  }

  return NextResponse.json(results);
}
