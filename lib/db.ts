import { Pool, PoolClient, QueryResult } from 'pg';

// Connection string for ParadeDB PostgreSQL
const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:dNGwXb9OCrJNNaJMoKI7@mail-paradedb-46ygk4-postgres-1:5432/app';

// Global singleton pool
declare global {
  var _pgPool: Pool | undefined;
}

const pool =
  global._pgPool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

// Convert SQLite '?' parameter placeholders to PostgreSQL '$1, $2, $3...'
export function formatSql(sql: string): string {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

let initPromise: Promise<void> | null = null;

// Initialize PostgreSQL / ParadeDB schema
export async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Categories
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Locations
      await client.query(`
        CREATE TABLE IF NOT EXISTS locations (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Assets
      await client.query(`
        CREATE TABLE IF NOT EXISTS assets (
          id SERIAL PRIMARY KEY,
          asset_name TEXT NOT NULL,
          asset_description TEXT DEFAULT '',
          serial_number TEXT DEFAULT '',
          model_number TEXT DEFAULT '',
          purchase_cost NUMERIC(15,2) DEFAULT 0,
          purchase_date TEXT DEFAULT '',
          supplier_name TEXT DEFAULT '',
          supplier_phone TEXT DEFAULT '',
          supplier_address TEXT DEFAULT '',
          location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          asset_status INTEGER DEFAULT 1,
          assigned_to TEXT DEFAULT '',
          asset_image TEXT DEFAULT '',
          warranty_period_month INTEGER DEFAULT 0,
          depreciation_months INTEGER DEFAULT 0,
          depreciation_percentage TEXT DEFAULT '',
          residual_value TEXT DEFAULT '',
          depreciation_method TEXT DEFAULT 'reducing_balance',
          appreciation_rate TEXT DEFAULT '',
          appreciation_periods TEXT DEFAULT '',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 4. Asset History
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_history (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          field TEXT,
          changed_from TEXT,
          changed_to TEXT,
          changed_by TEXT DEFAULT 'Admin',
          action TEXT,
          note TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 5. Asset Events
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_events (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          event_by TEXT DEFAULT 'Admin',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 6. Asset Files
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_files (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          file_size TEXT,
          file_type TEXT,
          file_url TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 7. Asset Reminders
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_reminders (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          description TEXT NOT NULL,
          reminder_date TEXT NOT NULL,
          is_notified INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 8. Asset Notes
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_notes (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          note_content TEXT NOT NULL,
          created_by TEXT DEFAULT 'Admin',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 9. Asset Audits
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_audits (
          id SERIAL PRIMARY KEY,
          audit_name TEXT NOT NULL,
          audit_by TEXT DEFAULT 'Admin',
          audit_date TEXT NOT NULL,
          assets_list TEXT,
          notes TEXT,
          is_finished INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 10. Asset Maintenance
      await client.query(`
        CREATE TABLE IF NOT EXISTS asset_maintenance (
          id SERIAL PRIMARY KEY,
          asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          cost NUMERIC(15,2) DEFAULT 0,
          start_date TEXT,
          end_date TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_assets_cat_id ON assets(category_id);
        CREATE INDEX IF NOT EXISTS idx_assets_loc_id ON assets(location_id);
        CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(asset_status);
        CREATE INDEX IF NOT EXISTS idx_asset_events_aid ON asset_events(asset_id);
        CREATE INDEX IF NOT EXISTS idx_asset_history_aid ON asset_history(asset_id);
      `);

      // Initial Seed Data if assets table is empty
      const assetCheck = await client.query('SELECT COUNT(*) as cnt FROM assets');
      const count = parseInt(assetCheck.rows[0]?.cnt || '0', 10);
      if (count === 0) {
        // Default category
        await client.query(`
          INSERT INTO categories (name, description)
          VALUES ('Laptop PC', 'Laptop & Personal Computer Assets')
          ON CONFLICT (name) DO NOTHING;
        `);

        // Default location
        await client.query(`
          INSERT INTO locations (name, description)
          VALUES ('Head Office', 'Jl. Gotong Royong I No.50, Ragunan, Jakarta Selatan')
          ON CONFLICT (name) DO NOTHING;
        `);

        const catRes = await client.query(`SELECT id FROM categories WHERE name = 'Laptop PC' LIMIT 1`);
        const locRes = await client.query(`SELECT id FROM locations WHERE name = 'Head Office' LIMIT 1`);
        const catId = catRes.rows[0]?.id || 1;
        const locId = locRes.rows[0]?.id || 1;

        // Migrated Asset: M1 Apple
        const insertAssetRes = await client.query(`
          INSERT INTO assets (
            asset_name, asset_description, serial_number, model_number,
            purchase_cost, purchase_date, supplier_name, category_id, location_id, asset_status,
            depreciation_method, depreciation_months, depreciation_percentage, residual_value
          ) VALUES (
            'M1 Apple', 'Office Laptop Workstation', '453453453453453', 'HDD 512 GB / Ram 16GB',
            500000, '2025-08-29', 'PT. Angan Kreasi Semesta', $1, $2, 1,
            'reducing_balance', 0, '', ''
          ) RETURNING id;
        `, [catId, locId]);

        const newAssetId = insertAssetRes.rows[0]?.id;

        if (newAssetId) {
          await client.query(`
            INSERT INTO asset_history (asset_id, action, note)
            VALUES ($1, 'System Migration', 'Migrated asset data from legacy Perfex CRM');
          `, [newAssetId]);

          await client.query(`
            INSERT INTO asset_events (asset_id, event_type, notes)
            VALUES ($1, 'Purchased & Registered', 'Initial acquisition from PT. Angan Kreasi Semesta');
          `, [newAssetId]);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      initPromise = null;
      throw error;
    } finally {
      client.release();
    }
  })();

  return initPromise;
}

// Database helper methods
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  await ensureSchema();
  const pgSql = formatSql(sql);
  const result = await pool.query(pgSql, params);
  return result.rows as T[];
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(sql: string, params: any[] = []): Promise<QueryResult> {
  await ensureSchema();
  const pgSql = formatSql(sql);
  return await pool.query(pgSql, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

const db = {
  pool,
  query,
  queryOne,
  execute,
  withTransaction,
  ensureSchema,
};

export default db;
