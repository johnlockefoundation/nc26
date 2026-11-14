#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const d = JSON.parse(readFileSync(resolve(REPO, 'backend/data/sources/fundraising.json'), 'utf8'));
const rows = d.fundraising.map((f) => {
  const adv = f.dem_amount - f.rep_amount;
  return `  ('${f.district_id}', '2026', ${f.dem_amount}, ${f.rep_amount}, ${adv}, '${f.reporting_period}', '${f.updated_at}', '${f.source_url}', '${f.dem_source_url}', '${f.rep_source_url}', '${f.source_method}', false)`;
}).join(',\n');
const sql = `-- Load FEC fundraising totals (Q3, through 2026-10-14) into Supabase.
-- Run in the Supabase SQL editor. Idempotent: re-run to refresh.
begin;

insert into public.fundraising
  (race_id, cycle, dem_amount, rep_amount, advantage, reporting_period,
   updated_at, source_url, dem_source_url, rep_source_url, source_method, is_seed) values
${rows}
on conflict (race_id, cycle) do update set
  dem_amount = excluded.dem_amount, rep_amount = excluded.rep_amount,
  advantage = excluded.advantage, reporting_period = excluded.reporting_period,
  updated_at = excluded.updated_at, source_url = excluded.source_url,
  dem_source_url = excluded.dem_source_url, rep_source_url = excluded.rep_source_url,
  source_method = excluded.source_method;

commit;
`;
writeFileSync(resolve(REPO, 'fundraising-load.sql'), sql);
console.log('Wrote fundraising-load.sql (' + d.fundraising.length + ' districts)');