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
    // Scan table p for email patterns
    const pRows = await stalwartPool.query('SELECT k, v FROM "p";');
    const emailsFound = new Set<string>();

    for (const row of pRows.rows) {
      const vStr = row.v ? row.v.toString('utf8', 0, row.v.length) : '';
      const matches = vStr.match(/[a-zA-Z0-9._%+-]+@skyconnection\.id/g);
      if (matches) {
        matches.forEach((m: string) => emailsFound.add(m.toLowerCase()));
      }
    }

    // Also check other tables
    for (const t of ['d', 'e', 'a', 'm']) {
      try {
        const rows = await stalwartPool.query(`SELECT * FROM "${t}" LIMIT 500;`);
        for (const row of rows.rows) {
          for (const val of Object.values(row)) {
            if (Buffer.isBuffer(val)) {
              const str = val.toString('utf8', 0, val.length);
              const matches = str.match(/[a-zA-Z0-9._%+-]+@skyconnection\.id/g);
              if (matches) {
                matches.forEach((m: string) => emailsFound.add(m.toLowerCase()));
              }
            }
          }
        }
      } catch (e) {}
    }

    await stalwartPool.end();

    return NextResponse.json({
      stalwartEmailsCount: emailsFound.size,
      stalwartEmails: Array.from(emailsFound),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
