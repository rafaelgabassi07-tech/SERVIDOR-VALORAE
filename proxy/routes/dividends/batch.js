import { sendJson, queryObject, readJsonBody } from '../../lib/core/http.js';
import { buildDividendsContract } from '../../lib/portfolio/dividends-contract.js';

async function payloadFromRequest(req = {}) {
  let query = {};
  try {
    query = queryObject(new URL(req.url || '/api/v1/dividends/batch', 'https://valorae.local').searchParams);
  } catch {}
  let body = {};
  const method = String(req.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const parsed = await readJsonBody(req);
    body = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }
  return { ...query, ...body };
}

export default async function handler(req, res) {
  try {
    if (String(req.method || 'GET').toUpperCase() === 'OPTIONS') {
      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', req?.headers?.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Valorae-Client-Id, X-Valorae-Client-Version, X-Valorae-Environment');
      return res.end('');
    }
    const payload = await payloadFromRequest(req);
    const result = await buildDividendsContract(payload);
    return sendJson(req, res, result, { cacheControl: 'private, max-age=60, stale-while-revalidate=600' });
  } catch (error) {
    return sendJson(req, res, {
      status: 'ERROR',
      endpoint: 'dividends-batch',
      message: error?.message || 'Falha ao consultar agenda de proventos.',
      partial: true,
      upcoming: [],
      portfolioUpcoming: []
    }, { status: error?.status || 500, cacheControl: 'no-store' });
  }
}
