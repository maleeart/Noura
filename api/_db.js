// api/_db.js — Redis storage via REDIS_URL
const { createClient } = require('redis');

let _client = null;
async function getClient() {
  if (_client) return _client;
  _client = createClient({ url: process.env.REDIS_URL });
  _client.on('error', () => { _client = null; });
  await _client.connect();
  return _client;
}

function userKey(dataPath) {
  const match = dataPath.match(/users\/([^/]+)\.json$/);
  if (!match) throw new Error(`Unknown dataPath: ${dataPath}`);
  return `user:${match[1]}`;
}

async function readData(dataPath) {
  const client = await getClient();
  const raw = await client.get(userKey(dataPath));
  return { json: raw ? JSON.parse(raw) : {}, sha: null };
}

async function writeData(dataPath, nextData) {
  const client = await getClient();
  const key = userKey(dataPath);
  const raw = await client.get(key);
  const existing = raw ? JSON.parse(raw) : {};
  const merged = {
    ...existing,
    ...nextData,
    meta: {
      ...(existing.meta || {}),
      ...(nextData.meta || {}),
      app: 'Noura',
      updatedAt: new Date().toISOString()
    }
  };
  await client.set(key, JSON.stringify(merged));
  return { data: merged, sha: null };
}

module.exports = { readData, writeData, getClient };
