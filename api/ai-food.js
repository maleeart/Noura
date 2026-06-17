
const { readGithubData, writeGithubData } = require('./_github');

function send(res, status, data) {
  res.status(status).setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data, null, 2));
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const { json, sha } = await readGithubData();
      return send(res, 200, { success: true, data: json, sha });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await writeGithubData(body.data || body, body.message || 'Update Noura data');
      return send(res, 200, { success: true, data: result.data, sha: result.sha });
    }

    return send(res, 405, { success: false, error: 'Method not allowed' });
  } catch (err) {
    return send(res, 500, { success: false, error: err.message });
  }
};
