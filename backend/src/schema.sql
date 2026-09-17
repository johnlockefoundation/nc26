PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- Districts: one row per (district, election cycle). Geometry is the raw
-- GeoJSON (simplified) for the district boundary. `competitive` is a per-cycle
-- designation (e.g. from the John Locke/Civitas CPI), independent of geometry.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS districts (
  district_id        TEXT NOT NULL,          -- e.g. NC-01, SD-18, HD-98
  race_type          TEXT NOT NULL,          -- us_house | state_senate | state_house
  district_number    INTEGER NOT NULL,
  election_cycle     TEXT NOT NULL,          -- e.g. 2026
  geometry           TEXT NOT NULL,          -- GeoJSON feature geometry
  competitive        INTEGER NOT NULL DEFAULT 0,
  competitive_source TEXT,
  competitive_reason TEXT,
  cpi_value          TEXT,                   -- internal use only, e.g. D+2 / R+0
  PRIMARY KEY (district_id, election_cycle)
);

-- ---------------------------------------------------------------------------
-- Candidates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
  candidate_id   TEXT PRIMARY KEY,
  district_id    TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  name           TEXT NOT NULL,
  party          TEXT NOT NULL,              -- D | R | ...
  incumbent      INTEGER NOT NULL DEFAULT 0,
  website        TEXT
);

-- ---------------------------------------------------------------------------
-- Individual polls (raw), one row per poll. The polling average is separate.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polls (
  poll_id        TEXT PRIMARY KEY,
  district_id    TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  pollster       TEXT NOT NULL,
  start_date     TEXT NOT NULL,
  end_date       TEXT NOT NULL,
  sample_size    INTEGER,
  population     TEXT,                        -- RV | LV | A
  dem_share      REAL NOT NULL,
  rep_share      REAL NOT NULL,
  margin         REAL NOT NULL,               -- dem_share - rep_share
  source_url     TEXT,
  source         TEXT,
  is_seed        INTEGER NOT NULL DEFAULT 0,
  ingested_at    TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Polling averages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS polling_averages (
  district_id    TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  dem_average    REAL,
  rep_average    REAL,
  margin         REAL,                        -- dem_average - rep_average
  n_polls        INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT,
  PRIMARY KEY (district_id, election_cycle)
);

-- ---------------------------------------------------------------------------
-- Prediction markets (raw contract prices + derived advantage)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS markets (
  district_id    TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  provider       TEXT NOT NULL,
  dem_price      REAL,                        -- cents per contract
  rep_price      REAL,
  advantage      REAL,                        -- dem_price - rep_price
  updated_at     TEXT,
  source_url     TEXT,
  is_seed        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (district_id, election_cycle, provider)
);

-- ---------------------------------------------------------------------------
-- Fundraising
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fundraising (
  district_id     TEXT NOT NULL,
  election_cycle  TEXT NOT NULL,
  dem_amount      REAL,
  rep_amount      REAL,
  advantage       REAL,                       -- dem_amount - rep_amount
  reporting_period TEXT,
  updated_at      TEXT,
  source_url      TEXT,
  source_method   TEXT,                       -- total_receipts | cash_on_hand
  is_seed         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (district_id, election_cycle)
);

-- ---------------------------------------------------------------------------
-- News
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news (
  article_id      TEXT PRIMARY KEY,
  district_id     TEXT NOT NULL,
  election_cycle  TEXT NOT NULL,
  headline        TEXT NOT NULL,
  outlet          TEXT NOT NULL,
  published_at    TEXT NOT NULL,
  url             TEXT,
  summary         TEXT,
  relevance_score REAL NOT NULL DEFAULT 0.5
);

-- ---------------------------------------------------------------------------
-- Ingestion run tracking: each data source tracks fetch/update status.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_meta (
  source       TEXT PRIMARY KEY,
  last_fetched TEXT,
  last_success TEXT,
  last_error   TEXT,
  status       TEXT DEFAULT 'never',          -- never | ok | error
  notes        TEXT
);

CREATE INDEX IF NOT EXISTS idx_polls_district ON polls (district_id, election_cycle);
CREATE INDEX IF NOT EXISTS idx_news_district ON news (district_id, election_cycle, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_district ON candidates (district_id, election_cycle);