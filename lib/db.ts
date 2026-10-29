import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Determine database path
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'inventory.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_name TEXT NOT NULL,
    asset_description TEXT,
    serial_number TEXT,
    model_number TEXT,
    purchase_cost REAL DEFAULT 0,
    purchase_date TEXT,
    supplier_name TEXT,
    supplier_phone TEXT,
    supplier_address TEXT,
    location_id INTEGER REFERENCES locations(id),
    category_id INTEGER REFERENCES categories(id),
    asset_status INTEGER DEFAULT 1, -- 1: Available, 2: Assigned/Allocated, 3: Revocate, 4: Lost, 5: Found, 6: Broken, 7: Dispose, 8: Donate, 9: Sell, 10: Repair, 11: Maintenance
    assigned_to TEXT,
    asset_image TEXT,
    warranty_period_month INTEGER DEFAULT 0,
    depreciation_months INTEGER DEFAULT 0,
    depreciation_percentage TEXT DEFAULT '',
    residual_value TEXT DEFAULT '',
    depreciation_method TEXT DEFAULT 'reducing_balance',
    appreciation_rate TEXT DEFAULT '',
    appreciation_periods TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    field TEXT,
    changed_from TEXT,
    changed_to TEXT,
    changed_by TEXT DEFAULT 'Admin',
    action TEXT,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_by TEXT DEFAULT 'Admin',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    file_size TEXT,
    file_type TEXT,
    file_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_reminders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    reminder_date TEXT NOT NULL,
    is_notified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    note_content TEXT NOT NULL,
    created_by TEXT DEFAULT 'Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_name TEXT NOT NULL,
    audit_by TEXT DEFAULT 'Admin',
    audit_date TEXT NOT NULL,
    assets_list TEXT,
    notes TEXT,
    is_finished INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cost REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe column migrations for existing SQLite databases
const ensureColumn = (table: string, col: string, typeDef: string) => {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${typeDef}`).run();
  } catch (e) {
    // Ignore if already exists
  }
};

ensureColumn('assets', 'warranty_period_month', 'INTEGER DEFAULT 0');
ensureColumn('assets', 'depreciation_months', 'INTEGER DEFAULT 0');
ensureColumn('assets', 'depreciation_percentage', 'TEXT DEFAULT ""');
ensureColumn('assets', 'residual_value', 'TEXT DEFAULT ""');
ensureColumn('assets', 'depreciation_method', 'TEXT DEFAULT "reducing_balance"');
ensureColumn('assets', 'appreciation_rate', 'TEXT DEFAULT ""');
ensureColumn('assets', 'appreciation_periods', 'TEXT DEFAULT ""');
ensureColumn('asset_history', 'field', 'TEXT');
ensureColumn('asset_history', 'changed_from', 'TEXT');
ensureColumn('asset_history', 'changed_to', 'TEXT');
ensureColumn('asset_history', 'changed_by', 'TEXT DEFAULT "Admin"');

// Seed initial data if empty
const assetCount = db.prepare('SELECT COUNT(*) as cnt FROM assets').get() as { cnt: number };
if (assetCount.cnt === 0) {
  // Category
  db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, description) 
    VALUES (1, 'Laptop PC', 'Laptop & Personal Computer Assets')
  `).run();

  // Location
  db.prepare(`
    INSERT OR IGNORE INTO locations (id, name, description) 
    VALUES (1, 'Head Office', 'Jl. Gotong Royong I No.50, Ragunan, Jakarta Selatan')
  `).run();

  // Migrated Asset: M1 Apple
  db.prepare(`
    INSERT INTO assets (
      id, asset_name, asset_description, serial_number, model_number,
      purchase_cost, purchase_date, supplier_name, category_id, location_id, asset_status,
      depreciation_method, depreciation_months, depreciation_percentage, residual_value
    ) VALUES (
      1, 'M1 Apple', 'Office Laptop Workstation', '453453453453453', 'HDD 512 GB / Ram 16GB',
      500000, '2025-08-29', 'PT. Angan Kreasi Semesta', 1, 1, 1,
      'reducing_balance', 0, '', ''
    )
  `).run();

  db.prepare(`
    INSERT INTO asset_history (asset_id, action, note)
    VALUES (1, 'System Migration', 'Migrated asset data from legacy Perfex CRM')
  `).run();

  db.prepare(`
    INSERT INTO asset_events (asset_id, event_type, notes)
    VALUES (1, 'Purchased & Registered', 'Initial acquisition from PT. Angan Kreasi Semesta')
  `).run();
}

export default db;
