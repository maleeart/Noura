const { env } = require('./_github');
const { requireSession } = require('./_auth');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return send(res, 405, { success: false, error: 'Method not allowed' });

    requireSession(req);

    const key = env('OPENROUTER_API_KEY');
    if (!key) return send(res, 400, { success: false, error: 'Missing OPENROUTER_API_KEY in Vercel Environment Variables' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const image = body.image;
    if (!image) return send(res, 400, { success: false, error: 'Missing image' });

    const models = [
      env('OPENROUTER_MODEL', 'google/gemini-2.5-flash'),
      'google/gemini-2.5-flash',
      'google/gemini-flash-latest',
      'google/gemini-2.5-pro'
    ];

    const messages = [
      {
        role: 'system',
        content: `You are a precise workout screenshot reader. Analyze the screenshot of a fitness app (like Apple Health, Garmin, Strava, Nike Run Club, etc.) to extract workout details. Return ONLY valid JSON with no extra text.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Identify the workout type, name, duration in minutes, distance in km (if applicable), and calories burned. Maps the workout type to one of these valid categories: ['Run','Walk','Ride','Weight Training','Calisthenics','HIIT','Circuit Training','Jump Rope','Swimming','Basketball','Football','Futsal','Badminton','Tennis','Pickleball','Table Tennis','Volleyball','Muay Thai','Boxing','Martial Arts','Yoga','Pilates','Dance','Zumba','Hike','Rock Climbing','Rowing','Kayaking','Skateboarding','Zone 2','Stretch','Workout','CrossFit','Cycling Indoor','Elliptical','Stair Climb','Golf']. \n\nReturn JSON only: {"type":"One of the valid categories","name":"A friendly name, e.g. Morning Run","durationMin":number,"distanceKm":number,"calories":number}`
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

    let lastError = null;
    let j = null;
    let succeeded = false;

    for (const model of [...new Set(models)]) {
      try {
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': env('APP_URL', 'https://noura.vercel.app'),
            'X-Title': 'Noura'
          },
          body: JSON.stringify({
            model,
            messages
          })
        });
        const responseData = await r.json();
        if (!r.ok) {
          throw new Error(responseData.error?.message || JSON.stringify(responseData));
        }
        j = responseData;
        succeeded = true;
        break;
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed:`, err.message);
      }
    }

    if (!succeeded) {
      throw new Error(lastError ? lastError.message : 'All models failed to return a response from OpenRouter');
    }

    const text = j.choices?.[0]?.message?.content || '';
    const found = text.match(/\{[\s\S]*\}/);
    if (!found) throw new Error('AI did not return JSON');
    const obj = JSON.parse(found[0]);

    return send(res, 200, {
      success: true,
      type: obj.type || 'Workout',
      name: obj.name || obj.type || 'Workout',
      durationMin: Math.round(obj.durationMin || 0),
      distanceKm: Number(obj.distanceKm || 0),
      calories: Math.round(obj.calories || 0),
      raw: text
    });
  } catch (err) {
    const status = String(err.message || '').startsWith('UNAUTHORIZED') ? 401 : 500;
    return send(res, status, { success: false, error: err.message });
  }
};
