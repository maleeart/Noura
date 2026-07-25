// api/ai-food.js - ต้อง login ก่อนถึงใช้ได้ (ป้องกัน spam OPENROUTER_API_KEY)
const { env } = require('./_github');
const { requireSession } = require('./_auth');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

    // ตรวจสอบ session (throw ถ้ายังไม่ได้ login)
    requireSession(req);

    const key = env('OPENROUTER_API_KEY');
    if (!key) return send(res, 400, { success: false, error: 'Missing OPENROUTER_API_KEY in Vercel Environment Variables' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const menu = String(body.menu || '').trim();
    const image = body.image;
    if (!menu && !image) return send(res, 400, { success: false, error: 'Missing menu or image' });

    let messages = [];
    if (image) {
      messages = [
        {
          role: 'system',
          content: `You are a precise Thai food nutrition database. Analyze the image to identify the food/drink. Use standard Thai portion sizes (1 serving as typically sold/served in Thailand). Base your estimates on well-known nutrition databases. Be conservative and accurate — do NOT hallucinate. Return ONLY valid JSON with no extra text.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Identify the food/drink in the image. Return JSON only: {"menu":"ชื่ออาหารภาษาไทย","calories":number,"protein":number,"serving":"1 หน่วยบริโภคทั่วไป เช่น 1 จาน, 1 ชิ้น"}`
            },
            {
              type: 'image_url',
              image_url: {
                url: image
              }
            }
          ]
        }
      ];
    } else {
      messages = [
        {
          role: 'system',
          content: `You are a precise Thai food nutrition database. Use standard Thai portion sizes (1 serving as typically sold/served in Thailand). Base your estimates on well-known nutrition databases (USDA, Thai FDA, Mahidol University food database). Be conservative and accurate — do NOT hallucinate. Return ONLY valid JSON with no extra text.`
        },
        {
          role: 'user',
          content: `เมนู: "${menu}"\n\nก่อนตอบ ให้เลือกหน่วยบริโภคทั่วไปที่คนไทยใช้เรียกเมนูนี้ (เช่น ชิ้น, จาน, ถ้วย, ทัพพี, ฟอง, แก้ว) ให้เหมาะกับชนิดอาหารนั้นๆ แล้วตอบคำถามนี้: "${menu} 1 (หน่วย) มีพลังงานกี่แคลอรี่ และมีโปรตีนกี่กรัม"\n\nReturn JSON only: {"calories":number,"protein":number,"serving":"1 หน่วยที่เลือก เช่น 1 ชิ้น"}`
        }
      ];
    }

    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env('APP_URL', 'https://noura.vercel.app'),
        'X-Title': 'Noura'
      },
      body: JSON.stringify({
        model: env('OPENROUTER_MODEL', 'google/gemini-flash-1.5'),
        messages
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || JSON.stringify(j));

    const text = j.choices?.[0]?.message?.content || '';
    const found = text.match(/\{[\s\S]*\}/);
    if (!found) throw new Error('AI did not return JSON');
    const obj = JSON.parse(found[0]);

    return send(res, 200, {
      success: true,
      menu: obj.menu || menu || '',
      calories: Math.round(obj.calories || obj.total_calories || 0),
      protein: Math.round(obj.protein || obj.total_protein || 0),
      serving: obj.serving || '',
      raw: text
    });
  } catch (err) {
    const status = String(err.message || '').startsWith('UNAUTHORIZED') ? 401 : 500;
    return send(res, status, { success: false, error: err.message });
  }
};
