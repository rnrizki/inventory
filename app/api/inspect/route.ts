import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const results: any = {};

  try {
    // 1. Inspect stalwart1 database
    const stalwartPool = new Pool({
      host: 'database-postgresql-fy9a1w',
      port: 5432,
      user: 'postgres',
      password: 'dNGwXb9OCrJNNaJMoKI7',
      database: 'stalwart1',
      connectionTimeoutMillis: 3000,
    });

    const stalwartTables = await stalwartPool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
    );
    results.stalwartTables = stalwartTables.rows.map((r: any) => r.table_name);

    for (const tbl of results.stalwartTables) {
      if (tbl.toLowerCase().includes('user') || tbl.toLowerCase().includes('principal') || tbl.toLowerCase().includes('account') || tbl.toLowerCase().includes('directory')) {
        const sample = await stalwartPool.query(`SELECT * FROM "${tbl}" LIMIT 10;`);
        results[`sample_${tbl}`] = sample.rows;
      }
    }
    await stalwartPool.end();

    // 2. Inspect keycloack database
    const keycloakPool = new Pool({
      host: 'database-postgresql-fy9a1w',
      port: 5432,
      user: 'postgres',
      password: 'dNGwXb9OCrJNNaJMoKI7',
      database: 'keycloack',
      connectionTimeoutMillis: 3000,
    });

    const realms = await keycloakPool.query('SELECT id, name FROM realm;');
    results.keycloakRealms = realms.rows;

    const users = await keycloakPool.query('SELECT id, username, email, realm_id, enabled FROM user_entity LIMIT 20;');
    results.keycloakUsers = users.rows;

    const clients = await keycloakPool.query('SELECT id, client_id, realm_id, enabled FROM client LIMIT 20;');
    results.keycloakClients = clients.rows;

    await keycloakPool.end();
  } catch (err: any) {
    results.error = err.message;
  }

  return NextResponse.json(results);
}
