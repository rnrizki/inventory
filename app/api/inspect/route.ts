import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const results: any = {};
  const stalwartPool = new Pool({
    host: 'database-postgresql-fy9a1w',
    port: 5432,
    user: 'postgres',
    password: 'dNGwXb9OCrJNNaJMoKI7',
    database: 'stalwart1',
    connectionTimeoutMillis: 3000,
  });

  try {
    for (const t of ['u', 'p', 'd', 'e', 'a']) {
      try {
        const cols = await stalwartPool.query(
          `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='${t}';`
        );
        const rows = await stalwartPool.query(`SELECT * FROM "${t}" LIMIT 10;`);
        results[t] = {
          columns: cols.rows,
          sample: rows.rows.map((r: any) => {
            const clean: any = {};
            for (const [k, v] of Object.entries(r)) {
              if (Buffer.isBuffer(v)) {
                clean[k] = `<Buffer len=${v.length}: ${v.toString('utf8', 0, Math.min(100, v.length)).replace(/[^\x20-\x7E]/g, '.')}>`;
              } else {
                clean[k] = v;
              }
            }
            return clean;
          }),
        };
      } catch (e: any) {
        results[`error_${t}`] = e.message;
      }
    }
    await stalwartPool.end();
  } catch (err: any) {
    results.error = err.message;
  }

  return NextResponse.json(results);
}
