import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const stalwartPool = new Pool({
    host: 'database-postgresql-fy9a1w',
    port: 5432,
    user: 'postgres',
    password: 'dNGwXb9OCrJNNaJMoKI7',
    database: 'stalwart1',
    connectionTimeoutMillis: 3000,
  });

  try {
    // Stalwart directory stores accounts under specific keys or formats
    const pRows = await stalwartPool.query('SELECT k, v FROM "p";');
    const principals: any[] = [];

    for (const row of pRows.rows) {
      const vStr = row.v ? row.v.toString('utf8', 0, row.v.length) : '';
      // Look for user definitions (often json or text with name/email/secret/roles)
      if (vStr.includes('@skyconnection.id') && (vStr.includes('individual') || vStr.includes('group') || vStr.includes('account') || vStr.includes('user') || vStr.includes('secret') || vStr.includes('roles'))) {
        principals.push({
          k_hex: row.k ? row.k.toString('hex') : '',
          v_preview: vStr.slice(0, 300).replace(/[^\x20-\x7E]/g, '.'),
        });
      }
    }

    await stalwartPool.end();

    return NextResponse.json({
      count: principals.length,
      principals: principals.slice(0, 20),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
