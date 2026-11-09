// Read-only proxy for a MySQL database, invoked via a Lambda Function URL.
//
// Design notes:
//   - NO arbitrary SQL. Clients send { op, params }; op is checked against an
//     allowlist and params are validated/coerced here.
//   - Credentials come from Lambda environment variables (encrypted at rest by
//     AWS), never from the request. The client only sends an x-api-key.
//   - The Lambda is VPC-attached and is the only thing with network access to
//     the database. The Function URL itself is public; the key check is the gate.
//   - Read-only by construction: every statement is a SELECT. Keep it that way.
//   - Reserved concurrency (set in template.yaml) caps how many copies can run.

import mysql from 'mysql2/promise';

let pool = null;
async function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    enableKeepAlive: true,
    multipleStatements: false,
  });
  return pool;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function checkApiKey(event) {
  const expected = process.env.API_KEY;
  if (!expected) return true; // dev only; set API_KEY in prod
  const got = event.headers?.['x-api-key'] || event.headers?.['X-Api-Key'];
  return got === expected;
}

const OPS = {
  async health() {
    const p = await getPool();
    const [rows] = await p.query('select 1 as ok');
    return { ok: rows?.[0]?.ok === 1 };
  },

  async election({ electionId }) {
    const id = Number(electionId);
    if (!Number.isInteger(id) || id <= 0) throw new Error('electionId must be a positive integer');
    const p = await getPool();
    const [rows] = await p.query(
      'select Name, TableName, date(ElectionDate) as electionDate from Elections where Id = ?',
      [id],
    );
    if (rows.length !== 1) throw new Error(`No election with Id ${id}`);
    const r = rows[0];
    if (!/^absentee_\d{8}$/.test(r.TableName)) throw new Error(`Refusing table name "${r.TableName}"`);
    return { name: r.Name, tableName: r.TableName, electionDate: r.electionDate };
  },

  async tableInfo({ tableName }) {
    if (!/^absentee_\d{8}$/.test(tableName)) throw new Error(`Refusing table name "${tableName}"`);
    const p = await getPool();
    const [rows] = await p.query(`select max(Created) as loadedAt, count(*) as rowCount from \`${tableName}\``);
    const r = rows[0];
    return { loadedAt: r.loadedAt, rowCount: Number(r.rowCount) };
  },

  async byDistrict({ tableName, column }) {
    if (!/^absentee_\d{8}$/.test(tableName)) throw new Error(`Refusing table name "${tableName}"`);
    if (!['HouseDist', 'SenDist', 'CongDist'].includes(column)) throw new Error(`Unknown column "${column}"`);
    const p = await getPool();
    const [rows] = await p.query(
      `select ${column} as d,
              sum(case when Party = 2 then 1 else 0 end) as dem,
              sum(case when Party = 1 then 1 else 0 end) as rep,
              sum(case when Party = 6 then 1 else 0 end) as unaff
       from \`${tableName}\`
       where ${column} > 0
       group by ${column}
       order by ${column}`,
    );
    return rows.map((r) => ({ d: Number(r.d), dem: Number(r.dem), rep: Number(r.rep), unaff: Number(r.unaff) }));
  },

  async minorParties({ tableName }) {
    if (!/^absentee_\d{8}$/.test(tableName)) throw new Error(`Refusing table name "${tableName}"`);
    const p = await getPool();
    const [rows] = await p.query(`select count(*) as n from \`${tableName}\` where Party not in (1, 2, 6)`);
    return { count: Number(rows[0].n) };
  },

  async statewide({ tableName }) {
    if (!/^absentee_\d{8}$/.test(tableName)) throw new Error(`Refusing table name "${tableName}"`);
    const p = await getPool();
    const [rows] = await p.query(
      `select sum(case when Party = 2 then 1 else 0 end) as dem,
              sum(case when Party = 1 then 1 else 0 end) as rep,
              sum(case when Party = 6 then 1 else 0 end) as unaff
       from \`${tableName}\``,
    );
    const r = rows[0];
    return { dem: Number(r.dem) || 0, rep: Number(r.rep) || 0, unaff: Number(r.unaff) || 0 };
  },
};

export const handler = async (event) => {
  const method = (event.requestContext?.http?.method || event.httpMethod || 'GET').toUpperCase();

  if (!checkApiKey(event)) return json(401, { error: 'invalid or missing x-api-key' });

  // GET (any path) is a health check.
  if (method === 'GET') {
    try { return json(200, await OPS.health()); }
    catch (e) { return json(500, { error: String(e.message || e) }); }
  }

  if (method !== 'POST') return json(405, { error: 'method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'invalid JSON body' }); }

  const op = body?.op;
  if (typeof op !== 'string' || !(op in OPS)) {
    return json(400, { error: `unknown op: ${op}`, allowed: Object.keys(OPS) });
  }

  try {
    const result = await OPS[op](body?.params || {});
    return json(200, { op, result });
  } catch (e) {
    return json(400, { error: String(e.message || e) });
  }
};
