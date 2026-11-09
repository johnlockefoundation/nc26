// Client-side adapter that talks to the MySQL proxy (Lambda Function URL) over
// HTTPS instead of a local `mysql` binary. Exposes the same primitives
// load-ballots.mjs needs.
//
// Env:
//   MYSQL_API_URL  base URL printed by the deploy (no trailing slash needed)
//   MYSQL_API_KEY  value of the x-api-key header
//
// The URL is used verbatim: nothing is stripped or appended, so it works for
// both a Lambda Function URL and an API Gateway stage URL.

import { request } from 'node:https';
import { URL } from 'node:url';

const BASE = (process.env.MYSQL_API_URL || '').replace(/\/+$/, '');

function call(op, params = {}, method = 'POST') {
  return new Promise((resolve, reject) => {
    if (!BASE) return reject(new Error('MYSQL_API_URL is not set'));
    const u = new URL(BASE);
    const data = method === 'POST' ? JSON.stringify({ op, params }) : null;
    const req = request(u, {
      method,
      headers: {
        ...(data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } : {}),
        ...(process.env.MYSQL_API_KEY ? { 'x-api-key': process.env.MYSQL_API_KEY } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(buf); } catch { return reject(new Error(`bad response: ${buf.slice(0, 200)}`)); }
        if (res.statusCode >= 400) return reject(new Error(parsed?.error || `HTTP ${res.statusCode}`));
        resolve(parsed.result ?? parsed);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

export const remote = {
  async health() { return call('health', {}, 'GET'); },
  async election(electionId) { return call('election', { electionId }); },
  async tableInfo(tableName) { return call('tableInfo', { tableName }); },
  async byDistrict(tableName, column) { return call('byDistrict', { tableName, column }); },
  async minorParties(tableName) { return call('minorParties', { tableName }); },
  async statewide(tableName) { return call('statewide', { tableName }); },
};

export default remote;
