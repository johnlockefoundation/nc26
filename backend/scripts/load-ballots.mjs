#!/usr/bin/env node
// Load ballot-request counts from the Carolina Elections MySQL database into
// public.race_vitals, as SQL for a human to run. This script never talks to
// Supabase and has no --apply: it reads the read-only MySQL endpoint, aggregates
// per district, and writes an INSERT file. Running that file is a person's job,
// the same division of labour as kalshi-load.sql.
//
// This loader exists under the same narrow exception as load-polls.mjs and
// fetch-kalshi.mjs: a human-run, no-cron, no-service_role hop that writes to
// Supabase through the ordinary SQL path. It is deliberately not a pipeline.
// Re-running it is how a second snapshot happens; nothing schedules it.
//
//   MYSQL_PASSWORD=... node backend/scripts/load-ballots.mjs
//   MYSQL_PASSWORD=... node backend/scripts/load-ballots.mjs --election 66 --out ballots-load.sql
//
// Env: MYSQL_PASSWORD required. MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE,
// MYSQL_CLIENT default to the read-only cluster and the mysql binary; none of
// the defaults is a secret and the password is never written to the output.
//
// Party codes are the tracker's own enums, decoded from the carolinaelections.com
// bundle (the site that displays this same database):
//   1 = Republican, 2 = Democratic, 3 = Libertarian, 4 = Green,
//   5 = Constitution, 6 = Unaffiliated
// Cross-checked against history: 2020's Democratic-heavy mail vote comes out
// under code 2, as it should. race_vitals only has dem/rep/unaff columns, so
// minor parties are counted and reported but not stored -- the loader says so
// in its own output rather than silently folding them into a party.
//
// The source tables carry no per-ballot request date (Created is the ETL load
// time), so a trend can only come from repeated runs on different days. Each
// run writes one snapshot, keyed by the date the source data was loaded.
// Two runs a week apart are what makes vitals_summary's velocity appear.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const ENV = {
  host: process.env.MYSQL_HOST
    || 'carolinaelections-3.cluster-ro-cdq9qw5jzol8.us-east-1.rds.amazonaws.com',
  user: process.env.MYSQL_USER || 'MihirKale',
  database: process.env.MYSQL_DATABASE || 'carolinaelections',
  client: process.env.MYSQL_CLIENT || 'mysql',
  password: process.env.MYSQL_PASSWORD,
};

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const electionId = Number(arg('--election', '66')); // 66 = 2026 General, same election the tracker link targets
const cycle = arg('--cycle', '2026');
const outFile = resolve(arg('--out', join(REPO, 'ballots-load.sql')));

if (!ENV.password) {
  console.error('MYSQL_PASSWORD is required (and is never written to the output file).');
  process.exit(1);
}
if (!Number.isInteger(electionId) || electionId <= 0) {
  console.error('--election must be the numeric Elections.Id.');
  process.exit(1);
}

// -B -N is machine output: tab-separated, no column-name header. The password
// goes through MYSQL_PWD rather than -p so it never appears in argv.
function query(sql) {
  const r = spawnSync(ENV.client, ['-h', ENV.host, '-u', ENV.user, '-B', '-N', ENV.database, '-e', sql], {
    encoding: 'utf8',
    env: { ...process.env, MYSQL_PWD: ENV.password },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error(`mysql failed (is the client installed? see MYSQL_CLIENT):\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
  return r.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
}

const [[electionCount]] = query(`select count(*) from Elections where Id = ${electionId}`);
if (Number(electionCount) !== 1) {
  console.error(`No election with Id ${electionId}.`);
  process.exit(1);
}
const [[electionName, tableName, electionDate]] = query(
  `select Name, TableName, date(ElectionDate) from Elections where Id = ${electionId}`,
);
// The table name comes from the database, so it is checked against the only
// shape a legal one can have before it goes anywhere near the statement.
if (!/^absentee_\d{8}$/.test(tableName)) {
  console.error(`Refusing table name "${tableName}".`);
  process.exit(1);
}

const [[loadedAt, rowCount]] = query(
  `select max(Created), count(*) from ${tableName}`,
);
if (!loadedAt || Number(rowCount) === 0) {
  console.error(`${tableName} has no rows; nothing to load.`);
  process.exit(1);
}
const snapshot = String(loadedAt).slice(0, 10);

// One aggregation shape three times over: district code in, three party
// columns out. GROUP BY the district column of the chamber.
function byDistrict(column) {
  return query(`
    select ${column} as d,
           sum(case when Party = 2 then 1 else 0 end) as dem,
           sum(case when Party = 1 then 1 else 0 end) as rep,
           sum(case when Party = 6 then 1 else 0 end) as unaff
    from ${tableName}
    where ${column} > 0
    group by ${column}
    order by ${column}
  `).map(([d, dem, rep, unaff]) => ({ d: Number(d), dem: +dem, rep: +rep, unaff: +unaff }));
}

const [[minorParties]] = query(
  `select count(*) from ${tableName} where Party not in (1, 2, 6)`,
);
const [[statewideDem, statewideRep, statewideUnaff]] = query(`
  select sum(case when Party = 2 then 1 else 0 end),
         sum(case when Party = 1 then 1 else 0 end),
         sum(case when Party = 6 then 1 else 0 end)
  from ${tableName}
`);

// district_id formats are the reference layer's, not invented here:
// state house unpadded (HD-60), senate and congress zero-padded to two
// (SD-04, NC-01), the U.S. Senate seat is the state (NC-SEN).
const pad2 = (n) => String(n).padStart(2, '0');
const rows = [
  ...byDistrict('HouseDist').map((r) => ({ id: `HD-${r.d}`, ...r })),
  ...byDistrict('SenDist').map((r) => ({ id: `SD-${pad2(r.d)}`, ...r })),
  ...byDistrict('CongDist').map((r) => ({ id: `NC-${pad2(r.d)}`, ...r })),
  {
    id: 'NC-SEN',
    d: null,
    dem: +statewideDem || 0,
    rep: +statewideRep || 0,
    unaff: +statewideUnaff || 0,
  },
];

if (rows.length === 0) {
  console.error('Aggregations returned nothing; refusing to write an empty load.');
  process.exit(1);
}

const source = `carolinaelections.com ${tableName} (loaded ${snapshot})`;
const values = rows.map((r) => (
  `  ('${r.id}', '${cycle}', '${snapshot}', '${snapshot}', ${r.dem}, ${r.rep}, ${r.unaff}, '${source}'::text)`
)).join(',\n');

const sql = `-- Ballot-request snapshot for race_vitals.
-- Generated by backend/scripts/load-ballots.mjs -- do not edit by hand; rerun
-- the loader instead. Safe to rerun: the same snapshot date upserts its counts,
-- so a re-run on the day the source database reloads refreshes this snapshot
-- rather than duplicating it.
--
-- election:     ${electionName} (Id ${electionId}, ${electionDate})
-- source table: ${tableName}
-- data loaded:  ${loadedAt} (${Number(rowCount).toLocaleString('en-US')} rows)
-- snapshots:    one, dated ${snapshot}. A second run on a later day is what
--               makes vitals_summary's velocity available; this file creates
--               none on its own.
-- not stored:   ${Number(minorParties).toLocaleString('en-US')} requests for parties other than Democratic,
--               Republican and Unaffiliated (race_vitals has three columns).
--
-- Apply with the Supabase SQL editor, or:
--   supabase db query --linked "$(cat ballots-load.sql)"
--
-- The exists() guard skips ids with no matching row in public.races instead of
-- failing the whole statement on the foreign key, so a district the app does
-- not know about costs nothing.

insert into public.race_vitals
  (race_id, cycle, snapshot, snapshot_date,
   ballots_req_dem, ballots_req_rep, ballots_req_unaff, is_mock, source)
select v.race_id, v.cycle, v.snapshot, v.snapshot_date::date,
       v.dem, v.rep, v.unaff, false, v.source
from (values
${values}
) as v(race_id, cycle, snapshot, snapshot_date, dem, rep, unaff, source)
where exists (
  select 1 from public.races r
  where r.id = v.race_id and r.cycle = v.cycle
)
on conflict (race_id, cycle, snapshot) do update
  set ballots_req_dem   = excluded.ballots_req_dem,
      ballots_req_rep   = excluded.ballots_req_rep,
      ballots_req_unaff = excluded.ballots_req_unaff,
      updated_at        = now();
`;

writeFileSync(outFile, sql);
console.log(`Wrote ${outFile}`);
console.log(`  election:    ${electionName} (Id ${electionId})`);
console.log(`  snapshot:    ${snapshot} (source loaded ${loadedAt})`);
console.log(`  seats:       ${rows.length} (${rows.filter((r) => r.id.startsWith('HD-')).length} house, `
  + `${rows.filter((r) => r.id.startsWith('SD-')).length} senate, `
  + `${rows.filter((r) => r.id.startsWith('NC-') && r.id !== 'NC-SEN').length} congress, 1 statewide)`);
console.log(`  statewide:   D ${statewideDem} / R ${statewideRep} / U ${statewideUnaff}`);
console.log(`  not stored:  ${minorParties} minor-party requests`);
console.log('Run the file against Supabase when ready (instructions are in its header).');
