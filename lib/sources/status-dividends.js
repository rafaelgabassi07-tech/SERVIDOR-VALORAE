import { fetchJson, fetchText } from './fetch.js';
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

function decodeStatusInvestText(value = '') {
  return String(value || '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\\\//g, '/');
}

function statusInvestPublicPagePaths(ticker = '') {
  const kind = classifyTicker(ticker);
  if (kind === 'FII') return ['fundos-imobiliarios', 'acoes'];
  if (kind === 'ETF') return ['etfs', 'acoes', 'fundos-imobiliarios'];
  if (kind === 'BDR') return ['bdrs', 'acoes'];
  return ['acoes', 'fundos-imobiliarios'];
}

function statusInvestVisibleText(value = '') {
  return decodeStatusInvestText(value)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#39|apos);/gi, "'")
    .replace(/&(?:lt);/gi, '<')
    .replace(/&(?:gt);/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusInvestTableCells(row = '') {
  return [...String(row || '').matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map(match => statusInvestVisibleText(match[1]))
    .filter(Boolean);
}

function dateFromVisibleCell(value = '') {
  const match = String(value || '').match(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/);
  return normalizeDate(match?.[0] || '');
}

function visibleDividendType(value = '') {
  const text = normalizeDividendText(value);
  if (!/(?:JCP|JSCP|DIVID|REND|AMORT|BONIF|PROVENT)/.test(text)) return '';
  return dividendType({ type: value });
}

function visibleDividendValue(value = '') {
  const text = String(value || '').replace(/R\$/gi, ' ').trim();
  const matches = [...text.matchAll(/(?:^|\s)(\d{1,3}(?:\.\d{3})*,\d+|\d+[,\.]\d{2,12})(?:\s|$)/g)];
  for (const match of matches) {
    const parsed = numberValue(match[1], NaN);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function parseStatusInvestVisibleTableEvents(ticker, html = '') {
  const clean = normalizeTicker(ticker);
  if (!clean || !String(html || '').trim()) return [];
  const events = [];
  const seen = new Set();
  const add = (raw = {}, sourceKind = 'confirmed-html-visible-table') => {
    const event = normalizeStatusEvent(clean, raw, sourceKind);
    if (!(event.grossValuePerShare > 0 || event.paymentDate || event.dateCom || event.exDate)) return;
    if (seen.has(event.eventKey)) return;
    seen.add(event.eventKey);
    events.push(event);
  };

  for (const match of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = statusInvestTableCells(match[1]);
    if (cells.length < 3) continue;
    const typeIndex = cells.findIndex(cell => Boolean(visibleDividendType(cell)));
    const dated = cells.map((cell, index) => ({ index, date: dateFromVisibleCell(cell) })).filter(item => item.date);
    if (typeIndex < 0 || dated.length === 0) continue;
    const type = cells[typeIndex];
    const dateCom = dated[0]?.date || '';
    const paymentDate = dated[1]?.date || '';
    let value = 0;
    for (let index = cells.length - 1; index >= 0; index -= 1) {
      if (index === typeIndex || dated.some(item => item.index === index)) continue;
      value = visibleDividendValue(cells[index]);
      if (value > 0) break;
    }
    add({ type, dateCom, paymentDate, value, valuePerShare: value, grossValuePerShare: value });
  }

  // O StatusInvest pode mudar a tabela para blocos responsivos sem <tr>. A página pública
  // continua expondo a sequência Tipo -> Data COM -> Pagamento -> Valor; este fallback lê
  // apenas a seção de dividendos e nunca tenta inferir datas ou valores fora dela.
  const plain = statusInvestVisibleText(html);
  const sectionStart = plain.search(/DIVIDENDOS\s+(?:DO|DA|DE)\s+[A-Z0-9]{4,12}/i);
  if (sectionStart >= 0) {
    const tail = plain.slice(sectionStart, sectionStart + 26000);
    const sectionEnd = tail.search(/\b(?:COMUNICADOS|EVENTOS\s+CORPORATIVOS|MAPA\s+DE\s+CALOR|ÍNDICES\s+COM|INDICES\s+COM)\b/i);
    const section = sectionEnd > 0 ? tail.slice(0, sectionEnd) : tail;
    const rowPattern = /\b(JSCP|JCP|DIVIDENDOS?|REND(?:IMENTO)?\.?\s*TRIB(?:UTADO)?|RENDIMENTOS?|AMORTIZA(?:ÇÃO|CAO))\b\s+(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})\s+(?:(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})|-)\s+(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d+|\d+[,\.]\d{2,12})/gi;
    for (const match of section.matchAll(rowPattern)) {
      const value = numberValue(match[4], 0);
      add({
        type: match[1],
        dateCom: match[2],
        paymentDate: match[3] || '',
        value,
        valuePerShare: value,
        grossValuePerShare: value
      }, 'confirmed-html-visible-text');
    }
  }
  return events;
}

function parseStatusInvestHtmlEvents(ticker, html = '') {
  const text = decodeStatusInvestText(html);
  const candidates = [];
  for (const m of text.matchAll(/assetEarningsModels"?\s*[:=]\s*(\[[\s\S]*?\])/gi)) candidates.push(m[1]);
  for (const m of text.matchAll(/"assetEarningsModels"\s*:\s*(\[[\s\S]*?\])/gi)) candidates.push(m[1]);
  const rawEvents = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
      if (Array.isArray(parsed)) rawEvents.push(...parsed);
    } catch {}
  }
  const embeddedEvents = rawEvents
    .map(item => normalizeStatusEvent(ticker, item, 'confirmed-html-embedded-json'))
    .filter(e => e.grossValuePerShare > 0 || e.paymentDate || e.dateCom || e.exDate);
  const visibleEvents = parseStatusInvestVisibleTableEvents(ticker, html);
  const merged = new Map();
  for (const event of [...embeddedEvents, ...visibleEvents]) {
    const previous = merged.get(event.eventKey);
    merged.set(event.eventKey, previous ? { ...event, ...previous } : event);
  }
  return [...merged.values()];
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
  const publicPagePaths = statusInvestPublicPagePaths(clean);
  const diagnostics = [];
  const preferVisiblePage = options.preferHtml === true || options.preferVisiblePage === true;
  const completenessMode = options.completenessMode !== false;
  const collected = [];
  let htmlAttempted = false;

  function appendEvents(events = []) {
    if (Array.isArray(events) && events.length) collected.push(...events);
  }

  async function tryVisiblePages() {
    htmlAttempted = true;
    for (const pagePath of publicPagePaths) {
      const pageUrl = `https://statusinvest.com.br/${pagePath}/${clean.toLowerCase()}`;
      const fetched = await fetchText(pageUrl, {
        timeoutMs: Math.max(1200, Math.min(statusInvestTimeoutMs(options), Number(options.htmlTimeoutMs || 4200))),
        ttlMs: options.ttlMs || 6 * 60 * 60 * 1000,
        staleMs: options.staleMs || 48 * 60 * 60 * 1000,
        headers: { Referer: 'https://statusinvest.com.br/' },
        signal: options.signal
      });
      const htmlEvents = fetched.text ? parseStatusInvestHtmlEvents(clean, fetched.text) : [];
      diagnostics.push({
        provider: 'statusinvest-html',
        pagePath,
        urlPolicy: 'public-visible-page',
        status: fetched.status,
        cacheStatus: fetched.cacheStatus,
        count: htmlEvents.length,
        error: fetched.error
      });
      if (htmlEvents.length > 0) return htmlEvents;
    }
    return [];
  }

  async function tryJsonEndpoints() {
    const jsonEvents = [];
    for (const type of types) {
      const url = `https://statusinvest.com.br/${type}/companytickerprovents?ticker=${encodeURIComponent(clean)}&chartProventsType=${statusInvestChartType()}`;
      const { json, status, cacheStatus, error, parseError } = await fetchJson(url, {
        timeoutMs: statusInvestTimeoutMs(options),
        ttlMs: options.ttlMs || 6 * 60 * 60 * 1000,
        staleMs: options.staleMs || 48 * 60 * 60 * 1000,
        headers: { 'X-Requested-With': 'XMLHttpRequest', Referer: `https://statusinvest.com.br/${publicPagePaths[0]}/${clean.toLowerCase()}` },
        signal: options.signal
      });
      const models = Array.isArray(json?.assetEarningsModels) ? json.assetEarningsModels : [];
      diagnostics.push({ provider: 'statusinvest', type, status, cacheStatus, count: models.length, chartProventsType: statusInvestChartType(), error, parseError });
      if (models.length > 0) {
        jsonEvents.push(...models
          .map(item => normalizeStatusEvent(clean, item, 'confirmed-per-ticker'))
          .filter(e => e.grossValuePerShare > 0 || e.paymentDate || e.dateCom));
        break;
      }
    }
    return jsonEvents;
  }

  // Completude da Agenda: uma fonte não encerra mais a coleta apenas porque retornou
  // alguma linha. A página pública e o endpoint JSON são complementares e podem ter
  // janelas diferentes de proventos; a união evita perder anúncios futuros válidos.
  if (preferVisiblePage && !envOff('VALORAE_STATUSINVEST_HTML_FALLBACK_ENABLED')) {
    appendEvents(await tryVisiblePages());
  }
  appendEvents(await tryJsonEndpoints());
  if ((!htmlAttempted || completenessMode) && !envOff('VALORAE_STATUSINVEST_HTML_FALLBACK_ENABLED')) {
    if (!htmlAttempted) appendEvents(await tryVisiblePages());
  }

  const merged = new Map();
  for (const event of collected) {
    const key = event.eventKey || [event.ticker, event.dateCom || event.exDate || '', event.paymentDate || '', event.dividendType || '', Number(event.grossValuePerShare || event.valuePerShare || 0).toFixed(8)].join('|');
    const previous = merged.get(key);
    merged.set(key, previous ? { ...event, ...previous, providers: [...new Set([...(previous.providers || []), previous.rawProvider, ...(event.providers || []), event.rawProvider].filter(Boolean))] } : event);
  }
  return { ticker: clean, events: [...merged.values()], diagnostics };
}

export const _test = {
  parseStatusInvestHtmlEvents,
  parseStatusInvestVisibleTableEvents,
  statusInvestPublicPagePaths,
  statusInvestVisibleText,
};
