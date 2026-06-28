// api/_db.js — Vercel KV storage, drop-in replacement for _github.js
// Key pattern: user:<userId>  (userId extracted from dataPath)
const { kv } = require('@vercel/kv');

function userKey(dataPath) {
  // dataPath = "data/users/<userId>.json"
  const match = dataPath.match(/users\/([^/]+)\.json$/);
  if (!match) throw new Error(`Unknown dataPath: ${dataPath}`);
  return `user:${match[1]}`;
}

async function readData(dataPath) {
  const json = await kv.get(userKey(dataPath));
  return { json: json || {}, sha: null };
}

async function writeData(dataPath, nextData, _message) {
  const key = userKey(dataPath);
  const existing = (await kv.get(key)) || {};
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
  await kv.set(key, merged);
  return { data: merged, sha: null };
}

module.exports = { readData, writeData };
