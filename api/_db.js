// api/_db.js — Upstash Redis storage, drop-in replacement for _github.js
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function userKey(dataPath) {
  const match = dataPath.match(/users\/([^/]+)\.json$/);
  if (!match) throw new Error(`Unknown dataPath: ${dataPath}`);
  return `user:${match[1]}`;
}

async function readData(dataPath) {
  const json = await redis.get(userKey(dataPath));
  return { json: json || {}, sha: null };
}

async function writeData(dataPath, nextData) {
  const key = userKey(dataPath);
  const existing = (await redis.get(key)) || {};
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
  await redis.set(key, merged);
  return { data: merged, sha: null };
}

module.exports = { readData, writeData, redis };
