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
    asset_status INTEGER DEFAULT 1, -- 1: Available, 2: Assigned, 3: Maintenance, 4: Retired
    assigned_to TEXT,
    asset_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS asset_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if empty (migrated from old server)
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
      purchase_cost, purchase_date, supplier_name, category_id, location_id, asset_status
    ) VALUES (
      1, 'M1 Apple', 'Office Laptop Workstation', '453453453453453', 'HDD 512 GB / Ram 16GB',
      500000, '2025-08-29', 'PT. Angan Kreasi Semesta', 1, 1, 1
    )
  `).run();

  db.prepare(`
    INSERT INTO asset_history (asset_id, action, note)
    VALUES (1, 'System Migration', 'Migrated asset data from legacy Perfex CRM')
  `).run();
}

export default db;
