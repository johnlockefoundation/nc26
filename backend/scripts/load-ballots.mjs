#!/usr/bin/env node
// Load ballot-request counts from the Carolina Elections MySQL database into
// public.race_vitals, as SQL for a human to run. This script never talks to
// Supabase and has no --apply: it reads the read-only MySQL endpoint,
// aggregates per district, and writes an INSERT file. Running that file is a
// person's job, the same division of labour as kalshi-load.sql.
//
// Two ways to reach MySQL:
//   - local (default): the `mysql` binary against the RDS cluster. Only works
//     from an IP the cluster's security group allows (the owner's machine).
//   - remote: set USE_REMOTE_MYSQL=1. Talks to the Lambda Function URL the IT
//     team deployed (MYSQL_API_URL + MYSQL_API_KEY), which is the IP-agnostic
//     path. Same queries, same output; nothing else changes.
//
//   MYSQL_PASSWORD=... node backend/scripts/load-ballots.mjs
//   USE_REMOTE_MYSQL=1 node backend/scripts/load-ballots.mjs
//   MYSQL_PASSWORD=... node backend/scripts/load-ballots.mjs --election 66 --out ballots-load.sql
//
// Env (local):  MYSQL_PASSWORD required. MYSQL_HOST, MYSQL_USER, MYSQL_DATABASE,
// MYSQL_CLIENT default to the read-only cluster and the mysql binary.
// Env (remote): MYSQL_API_URL + MYSQL_API_KEY required. No password needed.

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const USE_REMOTE = process.env.USE_REMOTE_MYSQL === '1' || process.env.USE_REMOTE_MYSQL === 'true';

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

const electionId = Number(arg('--election', '66'));
const cycle = arg('--cycle', '2026');
const outFile = resolve(arg('--out', join(REPO, 'ballots-load.sql')));

if (!Number.isInteger(electionId) || electionId <= 0) {
  console.error('--election must be the numeric Elections.Id.');
  process.exit(1);
}

// ---- data access: local mysql binary --------------------------------------

function localQuery(sql) {
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

// ---- data access: remote Lambda Function URL -------------------------------

let remote = null;
async function getRemote() {
  if (remote) return remote;
  if (!process.env.MYSQL_API_URL) {
    console.error('USE_REMOTE_MYSQL=1 requires MYSQL_API_URL.');
    process.exit(1);
  }
  if (!process.env.MYSQL_API_KEY) {
    console.error('USE_REMOTE_MYSQL=1 requires MYSQL_API_KEY.');
    process.exit(1);
  }
  const mod = await import('./lib/mysql-remote.mjs');
  remote = mod.default;
  return remote;
}

// ---- unified async accessors ----------------------------------------------

async function getElection(eid) {
  if (USE_REMOTE) {
    const r = await (await getRemote()).election(eid);
    if (!r || !r.tableName) throw new Error(`No election with Id ${eid}`);
    if (!/^absentee_\d{8}$/.test(r.tableName)) throw new Error(`Refusing table name "${r.tableName}".`);
    return { name: r.name, tableName: r.tableName, electionDate: r.electionDate };
  }
  if (!ENV.password) {
    console.error('MYSQL_PASSWORD is required (and is never written to the output file).');
    process.exit(1);
  }
  const [[count]] = localQuery(`select count(*) from Elections where Id = ${eid}`);
  if (Number(count) !== 1) throw new Error(`No election with Id ${eid}.`);
  const [[name, tableName, electionDate]] = localQuery(
    `select Name, TableName, date(ElectionDate) from Elections where Id = ${eid}`,
  );
  if (!/^absentee_\d{8}$/.test(tableName)) throw new Error(`Refusing table name "${tableName}".`);
  return { name, tableName, electionDate };
}

async function getTableInfo(tableName) {
  if (USE_REMOTE) {
    const r = await (await getRemote()).tableInfo(tableName);
    return { loadedAt: r.loadedAt, rowCount: Number(r.rowCount) };
  }
  const [[loadedAt, rowCount]] = localQuery(`select max(Created), count(*) from ${tableName}`);
  return { loadedAt, rowCount: Number(rowCount) };
}

async function getByDistrict(tableName, column) {
  if (USE_REMOTE) {
    const rows = await (await getRemote()).byDistrict(tableName, column);
    return rows.map((r) => ({ d: Number(r.d), dem: +r.dem, rep: +r.rep, unaff: +r.unaff }));
  }
  return localQuery(`
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

async function getMinorParties(tableName) {
  if (USE_REMOTE) {
    const r = await (await getRemote()).minorParties(tableName);
    return Number(r.count);
  }
  const [[n]] = localQuery(`select count(*) from ${tableName} where Party not in (1, 2, 6)`);
  return Number(n);
}

async function getStatewide(tableName) {
  if (USE_REMOTE) {
    const r = await (await getRemote()).statewide(tableName);
    return [+r.dem || 0, +r.rep || 0, +r.unaff || 0];
  }
  const [[dem, rep, unaff]] = localQuery(`
    select sum(case when Party = 2 then 1 else 0 end),
           sum(case when Party = 1 then 1 else 0 end),
           sum(case when Party = 6 then 1 else 0 end)
    from ${tableName}
  `);
  return [+dem || 0, +rep || 0, +unaff || 0];
}

// ---- main -----------------------------------------------------------------

async function main() {
  let election;
  try {
    election = await getElection(electionId);
  } catch (e) {
    console.error(e.message || e);
    process.exit(1);
  }
  const { name: electionName, tableName, electionDate } = election;

  const { loadedAt, rowCount } = await getTableInfo(tableName);
  if (!loadedAt || rowCount === 0) {
    console.error(`${tableName} has no rows; nothing to load.`);
    process.exit(1);
  }
  const snapshot = String(loadedAt).slice(0, 10);

  // Build rows with district_id formatting.
  const pad2 = (n) => String(n).padStart(2, '0');
  const house = (await getByDistrict(tableName, 'HouseDist')).map((r) => ({ id: `HD-${r.d}`, ...r }));
  const senate = (await getByDistrict(tableName, 'SenDist')).map((r) => ({ id: `SD-${pad2(r.d)}`, ...r }));
  const congress = (await getByDistrict(tableName, 'CongDist')).map((r) => ({ id: `NC-${pad2(r.d)}`, ...r }));
  const [statewideDem, statewideRep, statewideUnaff] = await getStatewide(tableName);
  const rows = [
    ...house,
    ...senate,
    ...congress,
    { id: 'NC-SEN', d: null, dem: statewideDem, rep: statewideRep, unaff: statewideUnaff },
  ];

  if (rows.length === 0) {
    console.error('Aggregations returned nothing; refusing to write an empty load.');
    process.exit(1);
  }

  const minorParties = await getMinorParties(tableName);

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
  console.log(`  mode:        ${USE_REMOTE ? 'remote (Lambda Function URL)' : 'local (mysql client)'}`);
  console.log(`  election:    ${electionName} (Id ${electionId})`);
  console.log(`  snapshot:    ${snapshot} (source loaded ${loadedAt})`);
  console.log(`  seats:       ${rows.length} (${house.length} house, `
    + `${senate.length} senate, ${congress.length} congress, 1 statewide)`);
  console.log(`  statewide:   D ${statewideDem} / R ${statewideRep} / U ${statewideUnaff}`);
  console.log(`  not stored:  ${minorParties} minor-party requests`);
  console.log('Run the file against Supabase when ready (instructions are in its header).');
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exit(1);
});
