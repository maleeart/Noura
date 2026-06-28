// api/migrate.js — one-time migration: GitHub files → Redis
// Protected: requires MIGRATE_SECRET header
// Safe to run multiple times
const { readGithubData, env } = require('./_github');
const { getClient } = require('./_db');

const GH_API = 'https://api.github.com';

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

async function listGithubUsers() {
  const token = env('GITHUB_TOKEN') || env('GH_TOKEN');
  const owner = env('GITHUB_OWNER') || 'maleeart';
  const repo = env('GITHUB_REPO') || 'Noura';
  const branch = env('GITHUB_BRANCH') || 'main';
  const url = `${GH_API}/repos/${owner}/${repo}/contents/data/users?ref=${branch}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'Noura-App' }
  });
  if (r.status === 404) return [];
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub list failed: ${data.message}`);
  return data.filter(f => f.name.endsWith('.json')).map(f => f.name.replace('.json', ''));
}

module.exports = async (req, res) => {
  const secret = env('MIGRATE_SECRET');
  if (!secret || req.headers['x-migrate-secret'] !== secret) {
    return send(res, 401, { success: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') return send(res, 405, { success: false, error: 'POST only' });

  try {
    const client = await getClient();
    const userIds = await listGithubUsers();
    if (!userIds.length) return send(res, 200, { success: true, migrated: [], note: 'No users found in GitHub' });

    const results = [];
    for (const userId of userIds) {
      try {
        const { json } = await readGithubData(`data/users/${userId}.json`);
        await client.set(`user:${userId}`, JSON.stringify(json));
        results.push({ userId, status: 'ok' });
      } catch (e) {
        results.push({ userId, status: 'error', error: e.message });
      }
    }

    return send(res, 200, { success: true, migrated: results });
  } catch (err) {
    return send(res, 500, { success: false, error: err.message });
  }
};
