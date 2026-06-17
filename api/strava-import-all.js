
// Vercel Serverless Function: /api/strava-import-all?limit=30
// ดึงกิจกรรม Strava ล่าสุด แล้ว merge เข้า data.json ใน GitHub repo เดียวกับ Noura
// ใช้ ENV จาก Vercel: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN,
// GITHUB_OWNER, GITHUB_REPO, GITHUB_TOKEN, optional GITHUB_BRANCH, DATA_PATH, USER_WEIGHT_KG

const { env, readGithubData, writeGithubData } = require('./_github');

function send(res, status, data) {
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
  const met = mets[a.type] || mets[a.sport_type] || 5;
  const hours = (a.moving_time || a.elapsed_time || 0) / 3600;
  const weight = Number(env('USER_WEIGHT_KG', '64.6'));
  return Math.max(0, Math.round(met * weight * hours));
}

async function getStravaAccessToken() {
  const required = ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REFRESH_TOKEN'];
  const missing = required.filter(k => !env(k));
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in Vercel Environment Variables`);

  const body = new URLSearchParams({
    client_id: env('STRAVA_CLIENT_ID'),
    client_secret: env('STRAVA_CLIENT_SECRET'),
    refresh_token: env('STRAVA_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  });

  const r = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
  const data = await r.json();
  if (!r.ok) throw new Error(`Strava token failed: ${data.message || JSON.stringify(data)}`);
  return data.access_token;
}

async function fetchActivities(accessToken, limit, page = 1) {
  const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${limit}&page=${page}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(`Strava activities failed: ${data.message || JSON.stringify(data)}`);
  return data;
}

function normalizeActivity(a) {
  const start = a.start_date_local || a.start_date || new Date().toISOString();
  return {
    id: `strava-${a.id}`,
    source: 'strava',
    sourceId: String(a.id),
    date: toDateOnly(start),
    time: start.slice(11, 16),
    type: a.sport_type || a.type || 'Workout',
    name: a.name || a.sport_type || a.type || 'Workout',
    durationMin: Math.round((a.moving_time || a.elapsed_time || 0) / 60),
    distanceKm: a.distance ? +(a.distance / 1000).toFixed(2) : 0,
    calories: estimateCalories(a),
    raw: {
      moving_time: a.moving_time,
      elapsed_time: a.elapsed_time,
      average_heartrate: a.average_heartrate,
      total_elevation_gain: a.total_elevation_gain,
      sport_type: a.sport_type,
      type: a.type
    },
    importedAt: new Date().toISOString()
  };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const accessToken = await getStravaAccessToken();
    const activities = await fetchActivities(accessToken, limit, page);
    const { json: current } = await readGithubData();

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

    current.workouts = Array.from(byId.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || '')));
    await writeGithubData(current, `Import Strava activities (${added} added, ${updated} updated)`);

    return send(res, 200, { success: true, checked: activities.length, added, updated, page, limit });
  } catch (err) {
    return send(res, 500, { success: false, error: err.message });
  }
};
console.log('Strava token response:', token);
if (!tokenRes.ok) {
  return res.status(500).json({
    success: false,
    strava: token
  });
}
