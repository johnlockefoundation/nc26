import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { CYCLE } from './ingest/config.js';
import { getMapFeatures, getRace, listRaces, getTicker, getSourceStatus } from './lib/races.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTLINE = join(__dirname, '..', 'data', 'geojson', 'state-outline.json');

const RACE_TYPES = new Set(['us_house', 'us_senate', 'state_senate', 'state_house']);
export const router = Router();

router.get('/health', (req, res) => res.json({ ok: true, cycle: CYCLE }));

router.get('/meta', (req, res) => {
  const counts = db.prepare(`SELECT race_type, COUNT(*) AS total,
      SUM(CASE WHEN competitive = 1 THEN 1 ELSE 0 END) AS competitive
    FROM districts WHERE election_cycle = ? GROUP BY race_type`).all(CYCLE);
  res.json({ cycle: CYCLE, race_types: counts, sources: getSourceStatus() });
});

router.get('/sources', (req, res) => res.json(getSourceStatus()));

router.get('/map', (req, res) => {
  const raceType = String(req.query.race_type || 'us_house');
  const cycle = String(req.query.cycle || CYCLE);
  if (!RACE_TYPES.has(raceType)) return res.status(400).json({ error: 'invalid race_type' });
  res.json(getMapFeatures({ cycle, raceType }));
});

router.get('/races', (req, res) => {
  const raceType = req.query.race_type ? String(req.query.race_type) : null;
  const cycle = String(req.query.cycle || CYCLE);
  const competitiveOnly = req.query.all !== '1';
  if (raceType && !RACE_TYPES.has(raceType)) return res.status(400).json({ error: 'invalid race_type' });
  res.json({ cycle, races: listRaces({ cycle, raceType, competitiveOnly }) });
});

router.get('/races/:districtId', (req, res) => {
  const cycle = String(req.query.cycle || CYCLE);
  const race = getRace(req.params.districtId, cycle);
  if (!race) return res.status(404).json({ error: 'race not found' });
  res.json(race);
});

router.get('/ticker', (req, res) => {
  const cycle = String(req.query.cycle || CYCLE);
  const limit = Math.min(Number(req.query.limit) || 10, 25);
  res.json({ cycle, items: getTicker({ cycle, limit }) });
});

router.get('/outline', (req, res) => {
  res.type('application/json').send(readFileSync(OUTLINE, 'utf8'));
});