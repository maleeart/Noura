// Noura public config (ปลอดภัยสำหรับ commit ขึ้น GitHub)
// Secret ทั้งหมดให้ตั้งใน Vercel Environment Variables เท่านั้น

const CONFIG = {
  APP_NAME: 'Noura',
  API_BASE: '', // ใช้ path เดียวกับโดเมน Vercel เช่น /api/data

  // ── Google Sign-In ──────────────────────────────────────────────
  // ใส่ Client ID จาก Google Cloud Console (OAuth 2.0 Client ID)
  // ตัวอย่าง: '1234567890-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com'
  GOOGLE_CLIENT_ID: '1089396342452-29vamc6a67vsb76l6ufld0e10gfj3p7d.apps.googleusercontent.com',

  // ── Owner Email ─────────────────────────────────────────────────
  // email ของเจ้าของแอพที่จะเห็นปุ่ม Strava (ตรงกับ OWNER_EMAIL ใน Vercel env)
  OWNER_EMAIL: 'tuangphetch@gmail.com'
};
