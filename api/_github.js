
const GH_API = 'https://api.github.com';

function env(name, fallback = '') {
  return process.env[name] || fallback;
}

function getGithubConfig(dataPath) {
  const token = env('GITHUB_TOKEN') || env('GH_TOKEN');
  const owner = env('GITHUB_OWNER') || env('GH_OWNER') || 'maleeart';
  const repo = env('GITHUB_REPO') || env('GH_REPO') || 'Noura';
  const branch = env('GITHUB_BRANCH') || env('GH_BRANCH') || 'main';
  // dataPath: path เฉพาะของผู้ใช้แต่ละคน เช่น data/users/<userId>.json
  // ถ้าไม่ส่งมา จะ fallback ไปที่ DATA_PATH (ใช้สำหรับ backward-compat / migration)
  const path = dataPath || env('DATA_PATH', 'data.json');
  if (!token) throw new Error('Missing GITHUB_TOKEN in Vercel Environment Variables');
  return { token, owner, repo, branch, path };
}

/**
 * อ่านไฟล์ข้อมูลของผู้ใช้คนหนึ่งจาก GitHub
 * dataPath: เช่น `data/users/<userId>.json`
 * ถ้าไฟล์ยังไม่มี (404) จะคืน json เป็น {} และ sha เป็น null (ไฟล์ใหม่)
 */
async function readGithubData(dataPath) {
  const ctx = getGithubConfig(dataPath);
  const url = `${GH_API}/repos/${ctx.owner}/${ctx.repo}/contents/${ctx.path}?ref=${ctx.branch}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Noura-App'
    }
  });

  if (r.status === 404) {
    // ผู้ใช้คนนี้ยังไม่มีไฟล์ข้อมูล (เพิ่งสมัครครั้งแรก)
    return { ctx, json: {}, sha: null };
  }

  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub read failed: ${data.message || JSON.stringify(data)}`);
  const content = Buffer.from(data.content || '', 'base64').toString('utf8');
  return { ctx, json: JSON.parse(content || '{}'), sha: data.sha };
}

/**
 * เขียนไฟล์ข้อมูลของผู้ใช้คนหนึ่งกลับไปที่ GitHub (สร้างไฟล์ใหม่ถ้ายังไม่มี)
 */
async function writeGithubData(dataPath, nextData, message = 'Update Noura data') {
  const latest = await readGithubData(dataPath);
  const ctx = latest.ctx;
  const merged = {
    ...(latest.json || {}),
    ...(nextData || {}),
    meta: {
      ...((latest.json || {}).meta || {}),
      ...((nextData || {}).meta || {}),
      app: 'Noura',
      updatedAt: new Date().toISOString()
    }
  };

  const url = `${GH_API}/repos/${ctx.owner}/${ctx.repo}/contents/${ctx.path}`;
  const body = {
    message,
    branch: ctx.branch,
    content: Buffer.from(JSON.stringify(merged, null, 2)).toString('base64')
  };
  if (latest.sha) body.sha = latest.sha; // มีค่าเฉพาะตอนไฟล์มีอยู่แล้ว (อัปเดต) ถ้าเป็นไฟล์ใหม่ไม่ต้องส่ง sha

  const r = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Noura-App'
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`GitHub write failed: ${data.message || JSON.stringify(data)}`);
  return { data: merged, sha: data.content?.sha };
}

module.exports = { env, readGithubData, writeGithubData };
