# Noura

Noura รวม Calman + Wracker เป็นแอพเดียว สำหรับบันทึกอาหาร ออกกำลังกาย นำเข้า Strava และคำนวณ TDEE/Calories ต่อวัน

## Deploy ที่แนะนำ

ใช้ Vercel เป็นหลัก เพราะ Secret จะอยู่ใน Environment Variables และหน้าเว็บจะเรียก API ผ่าน `/api/...`

## Environment Variables ที่ต้องมีใน Vercel

ตั้งค่าเหล่านี้ใน Project Settings > Environment Variables

```txt
GITHUB_OWNER=maleeart
GITHUB_REPO=Noura
GITHUB_TOKEN=github_pat_xxx
STRAVA_CLIENT_ID=xxx
STRAVA_CLIENT_SECRET=xxx
STRAVA_REFRESH_TOKEN=xxx
```

Optional:

```txt
GITHUB_BRANCH=main
DATA_PATH=data.json
USER_WEIGHT_KG=64.6
OPENROUTER_API_KEY=sk-or-xxx
OPENROUTER_MODEL=google/gemma-3-4b-it
APP_URL=https://your-noura.vercel.app
```

## GitHub Token

Token ต้องมีสิทธิ์อ่าน/เขียน repo contents อย่างน้อย:

- Contents: Read and write
- Metadata: Read

## ไฟล์ API

- `/api/data` อ่าน/เขียน `data.json` ผ่าน GitHub API โดยใช้ ENV จาก Vercel
- `/api/strava-import-all?limit=30` ดึงกิจกรรม Strava แล้ว merge เข้า `data.json`
- `/api/ai-food` วิเคราะห์อาหารผ่าน OpenRouter ถ้าตั้ง `OPENROUTER_API_KEY`

## หมายเหตุ

ถ้าเปิดผ่าน GitHub Pages อย่างเดียว ฟังก์ชัน `/api/...` จะไม่ทำงาน ต้องใช้ Vercel URL เป็นหลัก
