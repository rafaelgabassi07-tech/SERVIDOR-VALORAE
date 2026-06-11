import { fetchJson } from './fetch.js';
import { normalizeDate, eligibilityDateFromEvent, dateMillis } from '../core/dates.js';
import { numberValue, round } from '../core/numbers.js';
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

export function normalizeDividendText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&Ccedil;/gi, 'C')
    .replace(/&Atilde;/gi, 'A')
    .replace(/&Otilde;/gi, 'O')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export function dividendType(item = {}) {
  const raw = [
    item.etd, item.type, item.dividendType, item.tipo, item.eventType, item.tipoEvento,
    item.kind, item.proventoTipo, item.provento, item.category, item.description,
    item.descricao, item.label, item.nome, item.name
  ].filter(v => v !== undefined && v !== null).join(' ');
  const text = normalizeDividendText(raw);
  const compact = text.replace(/\s+/g, '');

  // Status Invest normalmente traz et/etd; mantemos o mapeamento numérico como fallback.
  if (item.et === 1 || item.eventTypeId === 1) return 'DIVIDENDO';
  if (item.et === 2 || item.eventTypeId === 2) return 'JCP';

  if (/\b(JSCP|JCP|JCSCP)\b/.test(text) || compact.includes('JUROSSOBRECAPITALPROPRIO') || compact.includes('JUROSSCAPITALPROPRIO') || compact.includes('JUROSCAPITALPROPRIO') || compact.includes('JUROCAPITALPROPRIO')) return 'JCP';
  if (/\b(DIV|DIVID|DIVIDENDO|DIVIDENDOS|DIVIDENDS|DIVIDEND)\b/.test(text) || compact.includes('DIVIDEND')) return 'DIVIDENDO';
  if (/\b(RENDIMENTO\s*TRIBUTADO|REND\s*TRIB|RENDA\s*TRIBUTADA|TRIBUTADO)\b/.test(text) || compact.includes('RENDIMENTOTRIBUTADO') || compact.includes('RENDTRIB')) return 'RENDIMENTO_TRIBUTADO';
  if (/\b(REN|REND|RENDIMENTO|RENDIMENTOS|DISTRIBUICAO|DISTRIBUICOES|DISTRIBUTION|INCOME)\b/.test(text) || compact.includes('RENDIMENTO')) return 'RENDIMENTO';
  if (/\b(AMORT|AMORTIZACAO|AMORTIZACOES|AMORTIZATION)\b/.test(text)) return 'AMORTIZACAO';
  if (/\b(BONIF|BONIFICACAO|BONIFICACOES|BONUS)\b/.test(text)) return 'BONIFICACAO';
  if (/\b(SUBSCRICAO|SUBSCRIPTION)\b/.test(text)) return 'SUBSCRICAO';
  if (/\b(REST|RESTITUICAO|CAPITAL)\b/.test(text) && /\bCAPITAL\b/.test(text)) return 'RESTITUICAO_DE_CAPITAL';
  if (/\b(PROVENTO|PROVENTOS|EARNING|EARNINGS)\b/.test(text)) return 'PROVENTO';
  return text || 'PROVENTO';
}

function numberFromAny(...values) {
  for (const value of values) {
    const n = numberValue(value, NaN);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function normalizeRate(raw, fallback = 0) {
  const n = numberValue(raw, NaN);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n > 1 ? n / 100 : n;
}

export function jcpTaxRateForDate(date = '') {
  const ts = dateMillis(date);
  const boundary = dateMillis('2026-01-01');
  const defaultRate = ts && boundary && ts >= boundary ? 0.175 : 0.15;
  const envName = ts && boundary && ts >= boundary ? 'VALORAE_JCP_TAX_RATE_2026' : 'VALORAE_JCP_TAX_RATE_PRE_2026';
  return normalizeRate(process.env[envName], defaultRate);
}


export function regressiveIncomeTaxRate(event = {}) {
  const start = dateMillis(event.dateCom || event.eligibilityDate || event.exDate || '');
  const end = dateMillis(event.paymentDate || event.payDate || event.dataPagamento || '');
  const days = start && end && end >= start ? Math.floor((end - start) / 86400000) : 0;
  if (days > 720) return normalizeRate(process.env.VALORAE_REND_TRIB_TAX_RATE_720D, 0.15);
  if (days > 360) return normalizeRate(process.env.VALORAE_REND_TRIB_TAX_RATE_361_720D, 0.175);
  if (days > 180) return normalizeRate(process.env.VALORAE_REND_TRIB_TAX_RATE_181_360D, 0.20);
  return normalizeRate(process.env.VALORAE_REND_TRIB_TAX_RATE_0_180D, 0.225);
}

export function applyDividendTax(event = {}, raw = {}) {
  const type = dividendType({ ...raw, dividendType: event.dividendType });
  const assetClass = event.assetClass || classifyTicker(event.ticker);
  const isStock = !String(assetClass || '').toUpperCase().includes('FII');
  const gross = numberFromAny(
    raw.grossValuePerShare, raw.valorBrutoPorAcao, raw.valorBrutoPorCota, raw.valorBruto,
    raw.v, raw.value, raw.valuePerShare, raw.valor, event.grossValuePerShare, event.valuePerShare
  );
  const explicitNet = numberFromAny(raw.netValuePerShare, raw.valorLiquidoPorAcao, raw.valorLiquidoPorCota, raw.valorLiquido, raw.liquidValuePerShare, event.netValuePerShare);
  const explicitRate = normalizeRate(raw.taxRate ?? raw.irRate ?? raw.aliquotaIr ?? raw.aliquotaIR, 0);
  const taxableJcp = Boolean(type === 'JCP' && isStock && gross > 0);
  const taxableTrib = Boolean(type === 'RENDIMENTO_TRIBUTADO' && isStock && gross > 0);
  const taxable = taxableJcp || taxableTrib;
  const taxRate = explicitRate || (taxableJcp ? jcpTaxRateForDate(event.paymentDate || event.dateCom || event.exDate || '') : (taxableTrib ? regressiveIncomeTaxRate(event) : 0));
  const taxWithheldPerShare = taxable ? round(gross * taxRate, 8) : 0;
  const net = explicitNet > 0 ? explicitNet : (taxable ? round(gross - taxWithheldPerShare, 8) : gross);
  return {
    ...event,
    dividendType: type,
    declaredValuePerShare: gross,
    grossValuePerShare: gross,
    netValuePerShare: net,
    valuePerShare: net,
    taxRate,
    taxWithheldPerShare,
    taxable,
    taxRule: taxableJcp ? `IRRF_JCP_ACOES_${Math.round(taxRate * 1000) / 10}%` : (taxableTrib ? `IRRF_REND_TRIB_ACOES_${Math.round(taxRate * 1000) / 10}%` : 'NAO_TRIBUTADO_NO_APP')
  };
}

function normalizeStatusEvent(ticker, raw = {}, sourceType = '') {
  const dateCom = normalizeDate(raw.ed || raw.dateCom || raw.dataCom || raw.recordDate || raw.dataBase);
  const exDate = normalizeDate(raw.exDate || raw.dataEx || raw.exDividendDate);
  const paymentDate = normalizeDate(raw.pd || raw.paymentDate || raw.dataPagamento || raw.payDate || raw.dataPagto);
  const base = {
    ticker: normalizeTicker(ticker),
    assetClass: classifyTicker(ticker),
    dateCom,
    exDate,
    paymentDate,
    valuePerShare: numberFromAny(raw.v, raw.value, raw.valuePerShare, raw.valor),
    dividendType: dividendType(raw),
    rawDividendType: raw.etd || raw.type || raw.dividendType || raw.tipo || '',
    rawEventTypeId: raw.et ?? raw.eventTypeId ?? null,
    source: 'VALORAE Fonte Oficial',
    sourceKind: sourceType || 'confirmed-per-ticker',
    status: paymentDate ? (dateMillis(paymentDate) <= Date.now() ? 'Recebido' : 'Previsto') : 'Anunciado/Provisionado',
    rawProvider: 'statusinvest'
  };
  const taxed = applyDividendTax(base, raw);
  const eligibility = eligibilityDateFromEvent(taxed);
  taxed.eligibilityDate = eligibility.date;
  taxed.eligibilityDateSource = eligibility.source;
  taxed.eventKey = [taxed.ticker, taxed.eligibilityDate || taxed.dateCom || taxed.exDate || '', taxed.paymentDate || '', taxed.dividendType, Number(taxed.grossValuePerShare || taxed.valuePerShare || 0).toFixed(8)].join('|');
  return taxed;
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
        events: models.map(item => normalizeStatusEvent(clean, item, 'confirmed-per-ticker')).filter(e => e.grossValuePerShare > 0 || e.paymentDate || e.dateCom),
        diagnostics
      };
    }
  }
  return { ticker: clean, events: [], diagnostics };
}
