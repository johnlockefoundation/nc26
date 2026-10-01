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
  cpi_value          TEXT,                   -- e.g. D+2 / R+0 (signed party lean magnitude)
  partisan_lean      TEXT,                   -- Civitas rating bucket: Safe | Likely | Lean | Toss-up
  partisan_party     TEXT,                   -- Civitas lean party: D | R
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
  website        TEXT,
  photo_url      TEXT,                      -- portrait, null renders as initials
  photo_source   TEXT                       -- provenance, e.g. ncleg.gov
);

-- ---------------------------------------------------------------------------
-- News. in_funnel marks the outlets that drive the top ticker (Locke, Carolina
-- Journal); district_id is the seat the story is about, null when it is not
-- seat-specific.
-- ---------------------------------------------------------------------------

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

-- Daily price snapshots per provider used to derive weekly movement
-- (e.g. Kalshi 7-day change) for the map arrows, independent of any
-- provider-side history API.
CREATE TABLE IF NOT EXISTS market_snapshots (
  district_id    TEXT NOT NULL,
  election_cycle TEXT NOT NULL,
  provider       TEXT NOT NULL,
  as_of          TEXT NOT NULL,                -- ISO date (YYYY-MM-DD)
  dem_price      REAL,                         -- last traded price (0-1)
  rep_price      REAL,
  dem_bid_price  REAL,                         -- live yes bid (0-1)
  rep_bid_price  REAL,
  PRIMARY KEY (district_id, election_cycle, provider, as_of)
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
  -- Per-party filings pages. The panel links each candidate to their own FEC
  -- record, and a single source_url can only name one of them, so the pair is
  -- stored explicitly. source_url is kept as the district-level pointer for
  -- anything that wants one link rather than two.
  dem_source_url  TEXT,
  rep_source_url  TEXT,
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
  relevance_score REAL NOT NULL DEFAULT 0.5,
  topic           TEXT NOT NULL DEFAULT 'race',  -- race | news
  in_funnel       INTEGER NOT NULL DEFAULT 0     -- 1 = drives the top ticker
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

-- ---------------------------------------------------------------------------
-- District profile: census + political snapshot shown in the race panel.
-- Only U.S. House districts carry a profile for now.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS district_profiles (
  district_id     TEXT NOT NULL,
  election_cycle  TEXT NOT NULL,
  median_age      REAL,
  median_income   INTEGER,
  bachelors_plus  REAL,
  race_white      REAL,
  race_black      REAL,
  race_hispanic   REAL,
  pres_margin     TEXT,                        -- e.g. R+16.5 / D+45.1
  cpi             TEXT,                        -- Civitas-style CPI, e.g. R+8
  source          TEXT,
  updated_at      TEXT,
  PRIMARY KEY (district_id, election_cycle)
);

-- Money for state legislative races, stored per candidate. The federal
-- fundraising table is already party-aggregate, but an NCSBE extract arrives
-- per committee, so the raw rows are kept at that grain and summed by party
-- when the API assembles a race. The panel shows one advantage figure for a
-- state race, exactly as it does for a federal one.
-- is_mock = 1 means placeholder figures pending an NC SBOE extract.
CREATE TABLE IF NOT EXISTS state_funds (
  district_id     TEXT NOT NULL,
  candidate_id    TEXT NOT NULL,
  election_cycle  TEXT NOT NULL,
  candidate_name  TEXT NOT NULL,
  party           TEXT NOT NULL,
  total_raised    REAL,
  total_spent     REAL,
  cash_on_hand    REAL,
  contributions   INTEGER,                     -- count of distinct donors
  small_donors    INTEGER,                     -- contributors under $200
  reporting_period TEXT,
  source_url      TEXT,
  is_mock         INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT,
  PRIMARY KEY (candidate_id, election_cycle)
);

-- Voter registration and ballot requests at two comparable snapshots, so a
-- race panel can show how fast each is moving rather than only where it
-- stands. The two snapshots are the same point in each cycle (mid-September,
-- ahead of early voting) so the comparison is like-for-like; snapshot_date
-- carries the actual date because the day matters, not just the year.
-- NCSBE publishes these by COUNTY; legislative districts are built from
-- county parts, so real per-district figures need an apportionment step that
-- does not exist as a published dataset. Rows are currently placeholders.
-- is_mock = 1 means invented figures.
CREATE TABLE IF NOT EXISTS district_vitals (
  district_id          TEXT NOT NULL,
  snapshot             TEXT NOT NULL,      -- '2024' | '2026'
  snapshot_date        TEXT NOT NULL,      -- e.g. '2024-09-20'
  election_cycle       TEXT NOT NULL,
  registered_total     INTEGER,
  registered_dem       INTEGER,
  registered_rep       INTEGER,
  registered_unaff     INTEGER,
  ballots_req_dem      INTEGER,
  ballots_req_rep      INTEGER,
  ballots_req_unaff    INTEGER,
  is_mock              INTEGER NOT NULL DEFAULT 0,
  source               TEXT,
  updated_at           TEXT,
  PRIMARY KEY (district_id, snapshot)
);

CREATE INDEX IF NOT EXISTS idx_state_funds_district ON state_funds (district_id, election_cycle);
CREATE INDEX IF NOT EXISTS idx_district_vitals ON district_vitals (district_id, election_cycle);

CREATE INDEX IF NOT EXISTS idx_polls_district ON polls (district_id, election_cycle);
CREATE INDEX IF NOT EXISTS idx_news_district ON news (district_id, election_cycle, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_candidates_district ON candidates (district_id, election_cycle);