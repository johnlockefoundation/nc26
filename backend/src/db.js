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
  if (!cols.some((c) => c.name === 'photo_source')) {
    db.exec(`ALTER TABLE candidates ADD COLUMN photo_source TEXT`);
  }
  // Candidate websites are out of product scope, so the column is dropped rather
  // than left dormant: a schema.sql edit cannot remove it from a database that
  // already exists, and CREATE TABLE IF NOT EXISTS would leave the old shape in
  // place for every existing local db. Requires SQLite 3.35+ (node:sqlite ships
  // far past that).
  if (cols.some((c) => c.name === 'website')) {
    db.exec(`ALTER TABLE candidates DROP COLUMN website`);
  }
  // Same reason as the candidate photo columns above: schema.sql only runs its
  // CREATE TABLE IF NOT EXISTS, which leaves an existing local db on the old
  // shape. holder_party/holder_name answer "who holds this seat", which the
  // candidate rows cannot express when the sitting member is retiring or was
  // appointed and is not a candidate.
  const districtCols = db.prepare(`PRAGMA table_info(districts)`).all();
  if (!districtCols.some((c) => c.name === 'holder_party')) {
    db.exec(`ALTER TABLE districts ADD COLUMN holder_party TEXT`);
  }
  if (!districtCols.some((c) => c.name === 'holder_name')) {
    db.exec(`ALTER TABLE districts ADD COLUMN holder_name TEXT`);
  }
  // state_funds and district_demographics are new tables rather than altered
  // columns, so there is nothing to migrate for them; schema.sql creates both
  // with CREATE TABLE IF NOT EXISTS.
  const newsCols = db.prepare(`PRAGMA table_info(news)`).all();
  if (!newsCols.some((c) => c.name === 'topic')) {
    db.exec(`ALTER TABLE news ADD COLUMN topic TEXT NOT NULL DEFAULT 'race'`);
  }
  if (!newsCols.some((c) => c.name === 'in_funnel')) {
    db.exec(`ALTER TABLE news ADD COLUMN in_funnel INTEGER NOT NULL DEFAULT 0`);
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
  const distCols = db.prepare(`PRAGMA table_info(districts)`).all();
  if (!distCols.some((c) => c.name === 'partisan_lean')) {
    db.exec(`ALTER TABLE districts ADD COLUMN partisan_lean TEXT`);
  }
  if (!distCols.some((c) => c.name === 'partisan_party')) {
    db.exec(`ALTER TABLE districts ADD COLUMN partisan_party TEXT`);
  }
  // Per-party FEC pages, added after the fact so the money panel can link each
  // candidate to their own filing rather than one of them.
  const fundCols = db.prepare(`PRAGMA table_info(fundraising)`).all();
  if (!fundCols.some((c) => c.name === 'dem_source_url')) {
    db.exec(`ALTER TABLE fundraising ADD COLUMN dem_source_url TEXT`);
  }
  if (!fundCols.some((c) => c.name === 'rep_source_url')) {
    db.exec(`ALTER TABLE fundraising ADD COLUMN rep_source_url TEXT`);
  }
}

export function nowIso() {
  return new Date().toISOString();
}