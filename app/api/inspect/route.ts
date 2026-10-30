import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const pool = new Pool({
    host: 'database-postgresql-fy9a1w',
    port: 5432,
    user: 'postgres',
    password: 'dNGwXb9OCrJNNaJMoKI7',
    database: 'keycloack',
    connectionTimeoutMillis: 5000,
  });

  try {
    const users = await pool.query('SELECT id, username, email, enabled, first_name, last_name, realm_id FROM user_entity;');
    const idps = await pool.query('SELECT internal_id, provider_alias, provider_id, realm_id FROM identity_provider;');
    const clients = await pool.query('SELECT id, client_id, name, realm_id, enabled FROM client;');
    const realms = await pool.query('SELECT id, name FROM realm;');
    const comp = await pool.query('SELECT id, name, provider_type, provider_id, realm_id FROM component;');

    await pool.end();

    return NextResponse.json({
      realms: realms.rows,
      users: users.rows,
      idps: idps.rows,
      clients: clients.rows,
      components: comp.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}

