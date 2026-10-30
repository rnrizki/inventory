import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const host = searchParams.get('host') || 'mail-paradedb-46ygk4-postgres-1';
  const port = parseInt(searchParams.get('port') || '5432');
  const user = searchParams.get('user') || 'postgres';
  const password = searchParams.get('password') || 'dNGwXb9OCrJNNaJMoKI7';
  const database = searchParams.get('database') || 'app';

  const results: any = { testedHost: host, port, user, database };

  try {
    const pool = new Pool({
      host,
      port,
      user,
      password,
      database,
      connectionTimeoutMillis: 3000,
    });

    const client = await pool.connect();
    const res = await client.query('SELECT version(), current_database(), current_user;');
    const extRes = await client.query('SELECT extname, extversion FROM pg_extension;');
    client.release();
    await pool.end();

    results.success = true;
    results.serverInfo = res.rows[0];
    results.extensions = extRes.rows;
  } catch (err: any) {
    results.success = false;
    results.error = err.message;
    results.code = err.code;
  }

  return NextResponse.json(results);
}
