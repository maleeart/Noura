// api/_auth.js
// จัดการเรื่อง Auth ทั้งหมด:
// 1) ตรวจสอบ Google ID Token (JWT) ที่ฝั่ง client ส่งมาหลัง Sign in with Google
// 2) ออก Session Token ของแอพเอง (เซ็นด้วย HMAC, ไม่ต้องพึ่ง DB ฝั่ง server)
// 3) ตรวจสอบ Session Token แล้วคืน "userId" (เอาไว้ใช้เป็นชื่อไฟล์ข้อมูลของแต่ละคน)

const crypto = require('crypto');
const { env } = require('./_github');

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 วัน

let cachedCerts = null;
let cachedCertsAt = 0;

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64');
}

function base64UrlEncode(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function getGoogleCerts() {
  const now = Date.now();
  if (cachedCerts && now - cachedCertsAt < 1000 * 60 * 60) return cachedCerts;
  const r = await fetch(GOOGLE_CERTS_URL);
  if (!r.ok) throw new Error('โหลด Google public key ไม่สำเร็จ');
  const data = await r.json();
  cachedCerts = data.keys || [];
  cachedCertsAt = now;
  return cachedCerts;
}

function jwkToPem(jwk) {
  // ใช้ Node crypto สร้าง public key จาก JWK (RSA) โดยตรง ไม่ต้องพึ่ง library ภายนอก
  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

/**
 * ตรวจสอบ Google ID Token (JWT) แบบเต็มรูปแบบ:
 * - signature ถูกต้องตาม public key ของ Google
 * - aud ตรงกับ GOOGLE_CLIENT_ID ของเรา
 * - iss เป็น accounts.google.com
 * - ยังไม่หมดอายุ (exp)
 * คืนค่า payload ของ token (มี email, name, picture, sub ฯลฯ)
 */
async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new Error('Invalid ID token format');
  }
  const [headerB64, payloadB64, sigB64] = idToken.split('.');
  const header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));

  const certs = await getGoogleCerts();
  const jwk = certs.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('ไม่พบ public key ของ Google ที่ตรงกับ token นี้');

  const publicKey = jwkToPem(jwk);
  const signedData = `${headerB64}.${payloadB64}`;
  const signature = base64UrlDecode(sigB64);

  const verified = crypto.verify(
    'RSA-SHA256',
    Buffer.from(signedData),
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PADDING },
    signature
  );
  if (!verified) throw new Error('Token signature ไม่ถูกต้อง');

  const clientId = env('GOOGLE_CLIENT_ID');
  if (!clientId) throw new Error('Missing GOOGLE_CLIENT_ID in Vercel Environment Variables');

  const audOk = payload.aud === clientId;
  const issOk = payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com';
  const notExpired = typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

  if (!audOk) throw new Error('Token นี้ไม่ได้ออกให้แอพนี้ (aud mismatch)');
  if (!issOk) throw new Error('Token ไม่ได้ออกโดย Google (iss mismatch)');
  if (!notExpired) throw new Error('Token หมดอายุแล้ว กรุณา Sign in ใหม่');
  if (!emailVerified) throw new Error('อีเมลนี้ยังไม่ได้รับการยืนยันจาก Google');
  if (!payload.email) throw new Error('Token ไม่มีอีเมล');

  return payload;
}

/** แปลง email เป็น userId ที่ปลอดภัยสำหรับใช้เป็นชื่อไฟล์ (hash, อ่านค่า email กลับไม่ได้) */
function emailToUserId(email) {
  const normalized = String(email).trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 32);
}

function getSessionSecret() {
  const secret = env('SESSION_SECRET');
  if (!secret) throw new Error('Missing SESSION_SECRET in Vercel Environment Variables');
  return secret;
}

/** ออก session token ของแอพเอง: header.payload.signature (คล้าย JWT แต่เซ็นด้วย HMAC-SHA256 ของเราเอง) */
function createSessionToken({ userId, email, name, picture }) {
  const header = { alg: 'HS256', typ: 'NOURA' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    userId,
    email,
    name: name || '',
    picture: picture || '',
    iat: now,
    exp: now + SESSION_TTL_SECONDS
  };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signed = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(signed).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${signed}.${sigB64}`;
}

/** ตรวจสอบ session token ของแอพเอง คืน payload ถ้าถูกต้อง ไม่งั้น throw */
function verifySessionToken(token) {
  if (!token || typeof token !== 'string') throw new Error('ไม่มี session token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Session token รูปแบบไม่ถูกต้อง');
  const [headerB64, payloadB64, sigB64] = parts;
  const signed = `${headerB64}.${payloadB64}`;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(signed).digest();
  const actualSig = base64UrlDecode(sigB64);

  if (expectedSig.length !== actualSig.length || !crypto.timingSafeEqual(expectedSig, actualSig)) {
    throw new Error('Session token ไม่ถูกต้อง (signature mismatch)');
  }

  const payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    throw new Error('Session หมดอายุแล้ว กรุณา Sign in ใหม่');
  }
  return payload;
}

/** ดึง session token จาก Authorization: Bearer <token> header ของ request */
function getTokenFromRequest(req) {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1] : null;
}

/** ใช้ใน handler ของแต่ละ API: ตรวจสอบ request แล้วคืน { userId, email, name, picture } หรือ throw ถ้าไม่ได้ login */
function requireSession(req) {
  const token = getTokenFromRequest(req);
  if (!token) throw new Error('UNAUTHORIZED: กรุณา Sign in ก่อนใช้งาน');
  try {
    return verifySessionToken(token);
  } catch (e) {
    throw new Error(`UNAUTHORIZED: ${e.message}`);
  }
}

module.exports = {
  verifyGoogleIdToken,
  emailToUserId,
  createSessionToken,
  verifySessionToken,
  getTokenFromRequest,
  requireSession
};
