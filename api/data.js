const { readData, writeData } = require('./_db');
const { requireSession } = require('./_auth');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

function userDataPath(userId) {
  return `data/users/${userId}.json`;
}

module.exports = async (req, res) => {
  try {
    const session = requireSession(req);
    const dataPath = userDataPath(session.userId);

    if (req.method === 'GET') {
      const { json } = await readData(dataPath);
      return send(res, 200, { success: true, data: json, sha: null });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await writeData(dataPath, body.data || body);
      return send(res, 200, { success: true, data: result.data, sha: null });
    }

    return send(res, 405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    const status = String(err.message || '').startsWith('UNAUTHORIZED') ? 401 : 500;
    return send(res, status, { success: false, error: err.message });
  }
};
