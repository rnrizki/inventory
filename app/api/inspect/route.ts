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
    const tables = [
      'a', 'f', 'j', 'w', 'k', 'm', 'p', 's', 'g', 'e', 'q', 'h', 'r', 'l',
      't', 'd', 'o', 'x', 'i', 'b', 'n', 'u', 'y', 's_trace', 's_email', 's_cal', 's_card'
    ];
    const counts: Record<string, number> = {};

    for (const t of tables) {
      try {
        const res = await stalwartPool.query(`SELECT COUNT(*) as cnt FROM "${t}";`);
        counts[t] = parseInt(res.rows[0].cnt, 10);
      } catch (e: any) {
        counts[t] = -1;
      }
    }
    await stalwartPool.end();

    return NextResponse.json(counts);
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
