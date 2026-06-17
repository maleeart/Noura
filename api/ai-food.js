
const { env } = require('./_github');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

    const key = env('OPENROUTER_API_KEY');
    if (!key) return send(res, 400, { success: false, error: 'Missing OPENROUTER_API_KEY in Vercel Environment Variables' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const menu = String(body.menu || '').trim();
    if (!menu) return send(res, 400, { success: false, error: 'Missing menu' });

    const prompt = `Estimate calories and protein for this Thai food. Return JSON only: {"calories":number,"protein":number}. Food: ${menu}`;
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env('APP_URL', 'https://noura.vercel.app'),
        'X-Title': 'Noura'
      },
      body: JSON.stringify({
        model: env('OPENROUTER_MODEL', 'google/gemma-3-4b-it'),
        messages: [{ role: 'user', content: prompt }]
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
      calories: Math.round(obj.calories || obj.total_calories || 0),
      protein: Math.round(obj.protein || obj.total_protein || 0),
      raw: text
    });
  } catch (err) {
    return send(res, 500, { success: false, error: err.message });
  }
};
