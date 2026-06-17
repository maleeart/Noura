# Noura

Noura รวม Calman + Wracker เป็นแอพเดียวสำหรับบันทึกอาหาร ออกกำลังกาย และคำนวณ TDEE/Calories ต่อวัน

## ไฟล์สำคัญ

- `index.html` หน้าแอพหลัก
- `config.js` ตั้งค่า GitHub/OpenRouter
- `data.json` ฐานข้อมูลรวม foods/workouts/steps/profile
- `manifest.json` สำหรับติดตั้งเป็น PWA
- `Noura.png` ไอคอนแอพ
- `api/strava-import-all.js` Vercel API สำหรับนำเข้ากิจกรรมจาก Strava แล้วบันทึกลง `data.json`

## วิธีใช้งานเร็วสุด

1. สร้าง repo ใหม่ชื่อ `Noura`
2. อัปโหลดไฟล์ทั้งหมดนี้ลง repo
3. เปิด GitHub Pages จาก Settings > Pages > Deploy from branch > main
4. แก้ `config.js` ให้ `GH_REPO: 'Noura'`
5. ถ้าจะให้หน้าเว็บเขียน `data.json` กลับ GitHub ได้ ให้ใส่ GitHub token ใน `getGH()`

## ใช้ Strava ผ่าน Vercel

เพิ่ม Environment Variables ใน Vercel:

```txt
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REFRESH_TOKEN=
GH_TOKEN=
GH_OWNER=maleeart
GH_REPO=Noura
GH_BRANCH=main
DATA_PATH=data.json
```

จากนั้นกดปุ่ม Import Strava ในแอพ หรือเปิด:

```txt
/api/strava-import-all?limit=30
```

## หมายเหตุความปลอดภัย

อย่าใส่ token จริงลง public repo ถ้าไม่จำเป็น โดยเฉพาะ GitHub token และ Strava secret
