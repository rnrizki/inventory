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
    connectionTimeoutMillis: 5000,
  });

  const kcPool = new Pool({
    host: 'database-postgresql-fy9a1w',
    port: 5432,
    user: 'postgres',
    password: 'dNGwXb9OCrJNNaJMoKI7',
    database: 'keycloack',
    connectionTimeoutMillis: 5000,
  });

  try {
    // Check all tables in stalwart1
    const tablesRes = await stalwartPool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public';`);
    const tables = tablesRes.rows.map(r => r.table_name);

    // Let's examine table 'd' rows where type is User or email
    const dRows = await stalwartPool.query(`SELECT k, v FROM "d";`);
    const usersFound: any[] = [];
    for (const row of dRows.rows) {
      const kBuf = Buffer.isBuffer(row.k) ? row.k : Buffer.from(row.k || '');
      const vBuf = Buffer.isBuffer(row.v) ? row.v : Buffer.from(row.v || '');
      const kStr = kBuf.toString('utf8');
      const vStr = vBuf.toString('utf8');
      // Look for strings containing @skyconnection.id or usernames
      if (kStr.includes('skyconnection.id') || vStr.includes('skyconnection.id') || vStr.includes('argon2')) {
        usersFound.push({
          kHex: kBuf.toString('hex'),
          kAscii: kStr.replace(/[^\x20-\x7E]/g, '.'),
          vAscii: vStr.replace(/[^\x20-\x7E]/g, '.'),
        });
      }
    }

    // Check keycloak skyconnection realm users
    const kcUsers = await kcPool.query(`
      SELECT id, username, email, enabled, first_name, last_name, realm_id 
      FROM user_entity 
      WHERE realm_id = '0dadbdef-88eb-47be-8368-9ebf9fcf4f98';
    `);

    await stalwartPool.end();
    await kcPool.end();

    // Search for trihantoro and inventory across all tables in stalwart
    const searchMatch: any[] = [];
    for (const t of ['d', 'w', 't', 'm', 'p', 's', 'g']) {
      try {
        const rows = await stalwartPool.query(`SELECT * FROM "${t}";`);
        for (const row of rows.rows) {
          for (const [col, val] of Object.entries(row)) {
            const str = Buffer.isBuffer(val) ? val.toString('utf8') : String(val);
            if (str.toLowerCase().includes('trihantoro') || str.toLowerCase().includes('inventory')) {
              searchMatch.push({ table: t, col, match: str.replace(/[^\x20-\x7E]/g, '.') });
            }
          }
        }
      } catch (e) {}
    }

    return NextResponse.json({
      searchMatch,
      kcUsers: kcUsers.rows,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack });
  }
}


