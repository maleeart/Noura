// Vercel Serverless Function: /api/strava-import-all?limit=30
// เฉพาะ owner เท่านั้น (ตรวจสอบ email จาก session)

const { env, readGithubData, writeGithubData } = require('./_github');
const { requireSession, emailToUserId } = require('./_auth');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

function toDateOnly(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function estimateCalories(a) {
  if (typeof a.calories === 'number' && a.calories > 0) return Math.round(a.calories);
  const mets = { Run: 9.8, Ride: 7.5, Walk: 3.5, Hike: 6, Workout: 5, WeightTraining: 4.5, VirtualRun: 9.8, VirtualRide: 7.5 };
  const met = mets[a.type] || mets[a.sport_type] || 5;
  const hours = (a.moving_time || a.elapsed_time || 0) / 3600;
  const weight = Number(env('USER_WEIGHT_KG', '64.6'));
  return Math.max(0, Math.round(met * weight * hours));
}

async function getStravaAccessToken() {
  const required = ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_REFRESH_TOKEN'];
  const missing = required.filter((key) => !env(key));
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in Vercel Environment Variables`);
  const body = new URLSearchParams({
    client_id: env('STRAVA_CLIENT_ID'),
    client_secret: env('STRAVA_CLIENT_SECRET'),
    refresh_token: env('STRAVA_REFRESH_TOKEN'),
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://www.strava.com/oauth/token', { method: 'POST', body });
  const tokenData = await response.json();
  if (!response.ok) throw new Error(`Strava token failed: ${JSON.stringify(tokenData)}`);
  return tokenData.access_token;
}

async function fetchActivities(accessToken, limit, page = 1) {
  const url = `https://www.strava.com/api/v3/athlete/activities?per_page=${limit}&page=${page}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(`Strava activities failed: ${JSON.stringify(data)}`);
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
    if (req.method !== 'GET' && req.method !== 'POST') {
      return send(res, 405, { success: false, error: 'Method not allowed' });
    }

    // ตรวจสอบ session
    const session = requireSession(req);

    // เช็คว่าเป็น owner email เท่านั้นถึงใช้ Strava ได้
    const ownerEmail = env('OWNER_EMAIL', '').toLowerCase().trim();
    if (!ownerEmail) throw new Error('Missing OWNER_EMAIL in Vercel Environment Variables');
    if (session.email.toLowerCase().trim() !== ownerEmail) {
      return send(res, 403, { success: false, error: 'ฟีเจอร์นี้สำหรับเจ้าของแอพเท่านั้น' });
    }

    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const page = Math.max(Number(req.query.page || 1), 1);
    const accessToken = await getStravaAccessToken();
    const activities = await fetchActivities(accessToken, limit, page);

    // เขียนลงไฟล์ข้อมูลของ owner โดยเฉพาะ
    const ownerUserId = emailToUserId(ownerEmail);
    const dataPath = `data/users/${ownerUserId}.json`;
    const { json: current } = await readGithubData(dataPath);

    current.workouts = Array.isArray(current.workouts) ? current.workouts : [];
    const imported = activities.map(normalizeActivity);
    const byId = new Map(current.workouts.map((w) => [w.id || `${w.source}-${w.sourceId}`, w]));

    let added = 0, updated = 0;
    for (const workout of imported) {
      if (byId.has(workout.id)) { updated += 1; } else { added += 1; }
      byId.set(workout.id, { ...(byId.get(workout.id) || {}), ...workout });
    }

    current.workouts = Array.from(byId.values()).sort(
      (a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time || '').localeCompare(String(a.time || ''))
    );

    await writeGithubData(dataPath, current, `Import Strava activities (${added} added, ${updated} updated)`);

    return send(res, 200, { success: true, checked: activities.length, added, updated, page, limit });
  } catch (err) {
    console.error(err);
    const status = String(err.message || '').startsWith('UNAUTHORIZED') ? 401 : 500;
    return send(res, status, { success: false, error: err.message });
  }
};
