// Noura config
// ใส่ค่า token เฉพาะ repo ส่วนตัวเท่านั้น อย่าแชร์ repo public พร้อม token จริง
// ถ้าใช้ GitHub Pages แบบแก้ data.json จากหน้าเว็บ ต้องใส่ GH token ที่มีสิทธิ์ contents:read/write
// ถ้าใช้ Vercel API สำหรับ Strava แนะนำใส่ secret ใน Environment Variables แทน ไม่ต้องใส่ในไฟล์นี้

const CONFIG = {
  APP_NAME: 'Noura',
  GH_OWNER: 'maleeart',
  GH_REPO: 'Noura',
  GH_BRANCH: 'main',
  DATA_PATH: 'data.json',

  // Frontend token: เว้นว่างไว้ก่อน แล้วค่อยใส่เองในเครื่อง/มือถือถ้าจำเป็น
  getGH: () => '',

  // OpenRouter API key สำหรับวิเคราะห์อาหารด้วย AI
  getOR: () => '',

  // model ฟรี/เบาที่เคยใช้ได้
  OR_MODEL: 'google/gemma-3-4b-it'
};
