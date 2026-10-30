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
    const results: any = {};
    for (const t of ['d', 'w', 't', 'm']) {
      const rows = await stalwartPool.query(`SELECT * FROM "${t}";`);
      results[t] = rows.rows.map((r: any) => {
        const rowClean: any = {};
        for (const [k, v] of Object.entries(r)) {
          if (Buffer.isBuffer(v)) {
            rowClean[k] = v.toString('utf8').replace(/[^\x20-\x7E]/g, '.');
          } else {
            rowClean[k] = v;
          }
        }
        return rowClean;
      });
    }
    await stalwartPool.end();

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
