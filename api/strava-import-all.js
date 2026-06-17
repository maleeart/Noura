// Vercel Serverless Function: /api/strava-import-all?limit=30
// ดึงกิจกรรม Strava ล่าสุด แล้ว merge เข้า data.json ใน GitHub repo เดียวกับ Noura

const GH_API = 'https://api.github.com';

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function json(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

function toDateOnly(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function estimateCalories(a) {
  if (typeof a.calories === 'number' && a.calories > 0) return Math.round(a.calories);
  const mets = {
    Run: 9.8,
    Ride: 7.5,
    Walk: 3.5,
    Hike: 6,
    Workout: 5,
    WeightTraining: 4.5,
    VirtualRun: 9.8,
    VirtualRide: 7.5
  };
  const met = mets[a.type] || 5;
  const hours = (a.moving_time || a.elapsed_time || 0) / 3600;
  const weight = Number(env('USER_WEIGHT_KG', '64.6'));
  return Math.max(0, Math.round(met * weight * hours));
}

async function getStravaAccessToken() {
  const body = new URLSearchParams({
    client_id: env('STRAVA_CLIENT_ID'),
    client_secret: env('STRAVA_CLIENT_SECRET'),
    refresh_token: env('STRAVA_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  });

  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
  const data = await r.json();
  if (!r.ok) throw new Error(`Strava token failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchActivities(accessToken, limit) {
  const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${limit}&page=1`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(`Strava activities failed: ${JSON.stringify(data)}`);
  return data;
}

async function readGithubData() {
  const owner = env('GH_OWNER', 'maleeart');
  const repo = env('GH_REPO', 'Noura');
  const branch = env('GH_BRANCH', 'main');
  const path = env('DATA_PATH', 'data.json');
  const token = env('GH_TOKEN');

  const url = `${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub read failed: ${JSON.stringify(data)}`);

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  return { json: JSON.parse(content), sha: data.sha, owner, repo, branch, path, token };
}

async function writeGithubData(ctx, nextData, message) {
  nextData.meta = nextData.meta || {};
  nextData.meta.app = 'Noura';
  nextData.meta.updatedAt = new Date().toISOString();

  const url = `${GH_API}/repos/${ctx.owner}/${ctx.repo}/contents/${ctx.path}`;
  const body = {
    message,
    branch: ctx.branch,
    sha: ctx.sha,
    content: Buffer.from(JSON.stringify(nextData, null, 2)).toString('base64')
  };

  const r = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${ctx.token}`, Accept: 'application/vnd.github+json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub write failed: ${JSON.stringify(data)}`);
  return data;
}

function normalizeActivity(a) {
  return {
    id: `strava-${a.id}`,
    source: 'strava',
    sourceId: String(a.id),
    date: toDateOnly(a.start_date_local || a.start_date),
    time: (a.start_date_local || a.start_date || '').slice(11, 16),
    type: a.type || a.sport_type || 'Workout',
    name: a.name || a.type || 'Workout',
    durationMin: Math.round((a.moving_time || a.elapsed_time || 0) / 60),
    distanceKm: a.distance ? +(a.distance / 1000).toFixed(2) : 0,
    calories: estimateCalories(a),
    raw: {
      moving_time: a.moving_time,
      elapsed_time: a.elapsed_time,
      average_heartrate: a.average_heartrate,
      total_elevation_gain: a.total_elevation_gain
    },
    importedAt: new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

    const limit = Math.min(Number(req.query.limit || 30), 100);
    const accessToken = await getStravaAccessToken();
    const activities = await fetchActivities(accessToken, limit);
    const ctx = await readGithubData();

    const current = ctx.json || {};
    current.workouts = Array.isArray(current.workouts) ? current.workouts : [];

    const imported = activities.map(normalizeActivity);
    const byId = new Map(current.workouts.map(w => [w.id || `${w.source}-${w.sourceId}`, w]));
    let added = 0;
    let updated = 0;

    for (const w of imported) {
      if (byId.has(w.id)) updated += 1;
      else added += 1;
      byId.set(w.id, { ...(byId.get(w.id) || {}), ...w });
    }

    current.workouts = Array.from(byId.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    await writeGithubData(ctx, current, `Import Strava activities (${added} added, ${updated} updated)`);

    return json(res, 200, { success: true, checked: activities.length, added, updated });
  } catch (err) {
    return json(res, 500, { success: false, error: err.message });
  }
};
