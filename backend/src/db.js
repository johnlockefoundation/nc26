import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'db');
const DB_PATH = join(DB_DIR, 'nc28.sqlite');

mkdirSync(DB_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

export function initSchema() {
  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  const cols = db.prepare(`PRAGMA table_info(candidates)`).all();
  if (!cols.some((c) => c.name === 'photo_url')) {
    db.exec(`ALTER TABLE candidates ADD COLUMN photo_url TEXT`);
  }
  const newsCols = db.prepare(`PRAGMA table_info(news)`).all();
  if (!newsCols.some((c) => c.name === 'topic')) {
    db.exec(`ALTER TABLE news ADD COLUMN topic TEXT NOT NULL DEFAULT 'race'`);
  }
  const hasSnap = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='market_snapshots'`)
    .get();
  if (hasSnap) {
    const snapCols = db.prepare(`PRAGMA table_info(market_snapshots)`).all();
    if (!snapCols.some((c) => c.name === 'dem_bid_price')) {
      db.exec(`ALTER TABLE market_snapshots ADD COLUMN dem_bid_price REAL`);
    }
    if (!snapCols.some((c) => c.name === 'rep_bid_price')) {
      db.exec(`ALTER TABLE market_snapshots ADD COLUMN rep_bid_price REAL`);
    }
  }
}

export function nowIso() {
  return new Date().toISOString();
}