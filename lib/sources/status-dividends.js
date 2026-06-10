import { fetchJson } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue } from '../core/numbers.js';
import { normalizeTicker, statusInvestType, classifyTicker } from '../core/tickers.js';

function envOff(name) {
  return ['0', 'false', 'no', 'off'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function statusInvestChartType() {
  const value = Number(process.env.VALORAE_STATUSINVEST_CHART_PROVENTS_TYPE || 2);
  return Number.isFinite(value) && value > 0 ? value : 2;
}

function statusInvestTimeoutMs(options = {}) {
  const value = Number(options.timeoutMs || process.env.VALORAE_STATUSINVEST_TIMEOUT_MS || 5500);
  return Number.isFinite(value) && value > 0 ? value : 5500;
}

function dividendType(item = {}) {
  const raw = String(item.etd || item.type || item.dividendType || '').toUpperCase();
  if (raw.includes('JURO') || raw.includes('JCP')) return 'JCP';
  if (raw.includes('DIVID')) return 'DIVIDENDO';
  if (raw.includes('REND')) return 'RENDIMENTO';
  if (item.et === 1) return 'DIVIDENDO';
  if (item.et === 2) return 'JCP';
  return raw || 'PROVENTO';
}

function normalizeStatusEvent(ticker, raw = {}, sourceType = '') {
  const dateCom = normalizeDate(raw.ed || raw.dateCom || raw.dataCom || raw.recordDate);
  const exDate = normalizeDate(raw.exDate || raw.dataEx);
  const paymentDate = normalizeDate(raw.pd || raw.paymentDate || raw.dataPagamento);
  const base = {
    ticker: normalizeTicker(ticker),
    assetClass: classifyTicker(ticker),
    dateCom,
    exDate,
    paymentDate,
    valuePerShare: numberValue(raw.v ?? raw.value ?? raw.valuePerShare ?? raw.valor, 0),
    dividendType: dividendType(raw),
    source: 'VALORAE Fonte Oficial',
    sourceKind: sourceType || 'confirmed-per-ticker',
    status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
    rawProvider: 'statusinvest'
  };
  const eligibility = eligibilityDateFromEvent(base);
  base.eligibilityDate = eligibility.date;
  base.eligibilityDateSource = eligibility.source;
  base.eventKey = [base.ticker, base.eligibilityDate || base.dateCom || base.exDate || '', base.paymentDate || '', base.dividendType, base.valuePerShare.toFixed(8)].join('|');
  return base;
}

export async function getConfirmedDividendsByTicker(ticker, options = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { ticker: clean, events: [], diagnostics: { skipped: 'emptyTicker' } };
  if (envOff('VALORAE_STATUSINVEST_ENABLED')) {
    return { ticker: clean, events: [], diagnostics: [{ provider: 'statusinvest', status: 'SKIPPED', reason: 'VALORAE_STATUSINVEST_ENABLED=0' }] };
  }
  const primaryType = statusInvestType(clean);
  const types = primaryType === 'acao' ? ['acao', 'fii'] : ['fii', 'acao'];
  const diagnostics = [];
  for (const type of types) {
    const url = `https://statusinvest.com.br/${type}/companytickerprovents?ticker=${encodeURIComponent(clean)}&chartProventsType=${statusInvestChartType()}`;
    const { json, status, cacheStatus, error } = await fetchJson(url, {
      timeoutMs: statusInvestTimeoutMs(options),
      ttlMs: options.ttlMs || 6 * 60 * 60 * 1000,
      staleMs: options.staleMs || 24 * 60 * 60 * 1000,
      headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://statusinvest.com.br/' }
    });
    const models = Array.isArray(json?.assetEarningsModels) ? json.assetEarningsModels : [];
    diagnostics.push({ provider: 'statusinvest', type, status, cacheStatus, count: models.length, chartProventsType: statusInvestChartType(), error });
    if (models.length > 0) {
      return {
        ticker: clean,
        events: models.map(item => normalizeStatusEvent(clean, item, 'confirmed-per-ticker')).filter(e => e.valuePerShare > 0 || e.paymentDate || e.dateCom),
        diagnostics
      };
    }
  }
  return { ticker: clean, events: [], diagnostics };
}
