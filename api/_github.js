
const GH_API = 'https://api.github.com';

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function getGithubConfig() {
  const token = env('GITHUB_TOKEN') || env('GH_TOKEN');
  const owner = env('GITHUB_OWNER') || env('GH_OWNER') || 'maleeart';
  const repo = env('GITHUB_REPO') || env('GH_REPO') || 'Noura';
  const branch = env('GITHUB_BRANCH') || env('GH_BRANCH') || 'main';
  const path = env('DATA_PATH', 'data.json');
  if (!token) throw new Error('Missing GITHUB_TOKEN in Vercel Environment Variables');
  return { token, owner, repo, branch, path };
}

async function readGithubData() {
  const ctx = getGithubConfig();
  const url = `${GH_API}/repos/${ctx.owner}/${ctx.repo}/contents/${ctx.path}?ref=${ctx.branch}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Noura-App'
    }
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub read failed: ${data.message || JSON.stringify(data)}`);
  const content = Buffer.from(data.content || '', 'base64').toString('utf8');
  return { ctx, json: JSON.parse(content || '{}'), sha: data.sha };
}

async function writeGithubData(nextData, message = 'Update Noura data') {
  const latest = await readGithubData();
  const ctx = latest.ctx;
  const merged = {
    ...(latest.json || {}),
    ...(nextData || {}),
    meta: {
      ...((latest.json || {}).meta || {}),
      ...((nextData || {}).meta || {}),
      app: 'Noura',
      updatedAt: new Date().toISOString()
    }
  };

  const url = `${GH_API}/repos/${ctx.owner}/${ctx.repo}/contents/${ctx.path}`;
  const body = {
    message,
    branch: ctx.branch,
    sha: latest.sha,
    content: Buffer.from(JSON.stringify(merged, null, 2)).toString('base64')
  };

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Noura-App'
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub write failed: ${data.message || JSON.stringify(data)}`);
  return { data: merged, sha: data.content?.sha };
}

module.exports = { env, readGithubData, writeGithubData };
