import express from 'express';
import cors from 'cors';
import { initSchema, db } from './db.js';
import { router } from './routes.js';
import { CYCLE } from './ingest/config.js';
import { ingestDistricts } from './ingest/districts.js';
import { ingestCivitas } from './ingest/civitas.js';
import { ingestUsHouse } from './ingest/us-house.js';
import { ingestSeedMetrics } from './ingest/metrics.js';

const PORT = process.env.PORT || 4000;

initSchema();

// First-run convenience: if the database has no districts, build it from the
// bundled seed so `npm run dev` works without an explicit ingest step.
function ensureSeeded() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM districts').get().n;
  if (count > 0) return;
  console.log('empty database — running initial ingest from bundled seed…');
  ingestDistricts(CYCLE);
  ingestCivitas(CYCLE);
  ingestUsHouse(CYCLE);
  ingestSeedMetrics(CYCLE);
}

ensureSeeded();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', router);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, () => {
  console.log(`NC race-signals API listening on http://localhost:${PORT}/api`);
});