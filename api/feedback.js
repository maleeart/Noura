// api/feedback.js — feedback จากผู้ใช้ถึงผู้พัฒนา
// POST: ผู้ใช้ที่ล็อกอินส่งข้อความได้ (เก็บใน Redis list)
// GET : เฉพาะ admin (OWNER_EMAIL) เปิดอ่านของทุกคนได้
const { getClient } = require('./_db');
const { requireSession } = require('./_auth');
const { env } = require('./_github');

const KEY = 'noura:feedback';
const MAX = 500; // ponytail: cap list; bump if feedback ever outgrows this

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

function isAdmin(session) {
  const owner = (env('OWNER_EMAIL') || '').trim().toLowerCase();
  return owner && String(session.email || '').trim().toLowerCase() === owner;
}

module.exports = async (req, res) => {
  try {
    const session = requireSession(req);
    const client = await getClient();

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const message = String(body.message || '').trim();
      if (!message) return send(res, 400, { success: false, error: 'ข้อความว่างเปล่า' });
      const item = {
        message: message.slice(0, 4000),
        name: session.name || '',
        email: session.email || '',
        at: new Date().toISOString()
      };
      await client.lPush(KEY, JSON.stringify(item));
      await client.lTrim(KEY, 0, MAX - 1);
      return send(res, 200, { success: true });
    }

    if (req.method === 'GET') {
      if (!isAdmin(session)) return send(res, 403, { success: false, error: 'เฉพาะผู้ดูแลระบบเท่านั้น' });
      const raw = await client.lRange(KEY, 0, -1);
      const items = raw.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
      return send(res, 200, { success: true, items });
    }

    return send(res, 405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    const status = String(err.message || '').startsWith('UNAUTHORIZED') ? 401 : 500;
    return send(res, status, { success: false, error: err.message });
  }
};
