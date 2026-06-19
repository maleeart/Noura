// api/auth-google.js
// Endpoint: POST /api/auth-google
// รับ Google ID Token จาก client (หลังกด Sign in with Google)
// ตรวจสอบความถูกต้องกับ Google แล้วออก "session token" ของแอพ Noura เอง
// session token นี้ client จะเก็บไว้แล้วแนบไปกับ request อื่น ๆ ผ่าน Authorization: Bearer <token>

const { verifyGoogleIdToken, emailToUserId, createSessionToken } = require('./_auth');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const idToken = body.idToken;
    if (!idToken) return send(res, 400, { success: false, error: 'Missing idToken' });

    const payload = await verifyGoogleIdToken(idToken);
    const userId = emailToUserId(payload.email);

    const sessionToken = createSessionToken({
      userId,
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture || ''
    });

    return send(res, 200, {
      success: true,
      sessionToken,
      user: {
        email: payload.email,
        name: payload.name || '',
        picture: payload.picture || ''
      }
    });
  } catch (err) {
    return send(res, 401, { success: false, error: err.message });
  }
};
