import { fetchJson, fetchText } from './fetch.js';
import { fetchB3IndexDailyEvolution } from '../market/b3-index-history.js';
import { getQuote, yahooSymbol } from './quotes.js';
import { getCdiAccumulatedSeries } from './cdi.js';
import { getIpcaSeries } from './ipca.js';
import { getConfirmedDividendsByTicker } from './status-dividends.js';
import { normalizeTicker, classifyTicker, statusInvestType, investidor10PageTypes, statusInvestPageTypes } from '../core/tickers.js';
import { numberValue, round } from '../core/numbers.js';
import { dateMillis } from '../core/dates.js';
import { extractInvestidor10ChartIds, discoverInvestidor10ChartApiUrls, buildInvestidor10CanonicalCharts } from '../market/investidor10-chart-extractor.js';
import { inspectSourceDrift } from '../resilience/source-drift.js';

const PERIOD_MAP = {
  '1D': { range: '1d', interval: '5m', ttlMs: 30_000, limit: 80 },
  '5D': { range: '5d', interval: '15m', ttlMs: 60_000, limit: 120 },
  '1M': { range: '1mo', interval: '1d', ttlMs: 5 * 60_000, limit: 31 },
  '3M': { range: '3mo', interval: '1d', ttlMs: 10 * 60_000, limit: 95 },
  '6M': { range: '6mo', interval: '1d', ttlMs: 15 * 60_000, limit: 130 },
  'YTD': { range: 'ytd', interval: '1d', ttlMs: 15 * 60_000, limit: 260 },
  '1Y': { range: '1y', interval: '1d', ttlMs: 30 * 60_000, limit: 260 },
  '2Y': { range: '2y', interval: '1d', ttlMs: 30 * 60_000, limit: 520 },
  '5Y': { range: '5y', interval: '1wk', ttlMs: 60 * 60_000, limit: 280 },
  'MAX': { range: '10y', interval: '1mo', ttlMs: 6 * 60 * 60_000, limit: 240 }
};

const OFFICIAL_B3_INDEX_ALIASES = {
  IFIX: 'IFIX', '^IFIX': 'IFIX',
  IBOV: 'IBOV', IBOVESPA: 'IBOV', '^BVSP': 'IBOV',
  SMLL: 'SMLL', SMALL: 'SMLL',
  IDIV: 'IDIV'
};

function officialB3IndexCode(raw = '', normalized = '') {
  const cleanRaw = String(raw || '').trim().toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  const cleanNorm = String(normalized || '').trim().toUpperCase().replace(/\.SA$/i, '').replace(/[^A-Z0-9^]/g, '');
  return OFFICIAL_B3_INDEX_ALIASES[cleanRaw] || OFFICIAL_B3_INDEX_ALIASES[cleanNorm] || null;
}

const DIRECT_YAHOO_INDEX_SYMBOLS = {
  // Símbolos diretos confirmados no Yahoo Finance para os índices usados no Retorno.
  // Não são ETFs nem tickers proxy: são as páginas/series do próprio índice no Yahoo.
  IBOV: ['^BVSP'],
  IFIX: ['IFIX.SA', '^IFIX'],
  SMLL: ['SMLL.SA', '^SMLL'],
  IDIV: ['IDIV.SA', '^IDIV'],
  // IVVB11 é usado como benchmark real no gráfico de Retorno e também pode ser
  // exibido na Análise quando houver série real. Não é proxy de índice.
  IVVB11: ['IVVB11.SA']
};

const INVESTIDOR10_INDEX_SLUGS = {
  IFIX: ['ifix'],
  SMLL: ['smll', 'small'],
  IDIV: ['idiv'],
  IBOV: ['ibovespa', 'ibov']
};


const MAIS_RETORNO_INDEX_SLUGS = {
  IFIX: ['ifix'],
  SMLL: ['smll'],
  IDIV: ['idiv'],
  IBOV: ['ibovespa', 'ibov']
};


function investidor10ExtractorTypeFromPath(pathOrType = '') {
  const raw = String(pathOrType || '').toLowerCase();
  if (raw.includes('fii')) return 'fii';
  if (raw.includes('etf')) return 'etf';
  if (raw.includes('bdr')) return 'bdr';
  return 'acao';
}

function canonicalInvestidor10Type(type = '') {
  const raw = String(type || '').toLowerCase();
  if (raw === 'fii' || raw === 'fiis') return 'FII';
  if (raw === 'etf' || raw === 'etfs') return 'ETF';
  return 'ACAO';
}

function statusInvestProviderFromUrl(url = '') {
  const raw = String(url || '').toLowerCase();
  if (raw.includes('/bdrs/')) return 'statusinvest-bdrs';
  if (raw.includes('/etfs/')) return 'statusinvest-etfs';
  if (raw.includes('/fii/')) return 'statusinvest-fii';
  return 'statusinvest-acao';
}

function investidor10ProviderFromUrl(url = '') {
  const raw = String(url || '').toLowerCase();
  if (raw.includes('/bdrs/')) return 'investidor10-bdrs';
  if (raw.includes('/etfs/')) return 'investidor10-etfs';
  if (raw.includes('/fiis/')) return 'investidor10-fiis';
  return 'investidor10-acoes';
}

function parsePercentBR(value = '') {
  const raw = String(value || '').replace(/%/g, '').trim();
  if (!raw || raw === '--' || raw === '-') return NaN;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function lastDayOfMonthIso(year, month) {
  const d = new Date(Date.UTC(Number(year), Number(month), 0, 12, 0, 0));
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : '';
}

function parseMaisRetornoMonthlyReturns(html = '', indexCode = '', sourceLabel = 'Mais Retorno índice') {
  const text = stripHtml(html || '');
  if (!text || !/Rentabilidade\s+hist[oó]rica/i.test(text)) return [];
  const currentYear = new Date().getUTCFullYear();
  const currentMonth = new Date().getUTCMonth() + 1;
  const startIdx = Math.max(0, text.search(/Rentabilidade\s+hist[oó]rica/i));
  const historical = text.slice(startIdx);
  const yearMatches = [...historical.matchAll(/\b(20\d{2}|19\d{2})\b/g)]
    .map(m => ({ year: Number(m[1]), index: m.index || 0 }))
    .filter(item => item.year >= 1990 && item.year <= currentYear)
    .filter((item, idx, arr) => idx === 0 || item.index !== arr[idx - 1].index);
  const rows = [];
  for (let i = 0; i < yearMatches.length; i++) {
    const year = yearMatches[i].year;
    const nextIndex = yearMatches[i + 1]?.index ?? historical.length;
    const block = historical.slice(yearMatches[i].index, nextIndex);
    if (!new RegExp(String(indexCode || ''), 'i').test(block) && !/p\.p\.\s+acima\s+IBOV/i.test(block)) continue;
    const afterMarker = block.split(/p\.p\.\s+acima\s+IBOV/i).pop() || block;
    const percentTokens = [...afterMarker.matchAll(/(?:[+-]?\d{1,3}(?:\.\d{3})*,\d+%|[+-]?\d+(?:,\d+)?%|--|-)/g)].map(m => m[0]);
    if (!percentTokens.length) continue;
    const monthsWanted = year === currentYear ? currentMonth : 12;
    let month = 1;
    let tokenIndex = 0;
    while (month <= 12 && tokenIndex < percentTokens.length) {
      const token = percentTokens[tokenIndex++];
      if (token === '-') continue;
      if (token === '--') { month++; continue; }
      const monthlyPercent = parsePercentBR(token);
      if (!Number.isFinite(monthlyPercent)) { month++; continue; }
      if (month <= monthsWanted) rows.push({ year, month, monthlyPercent });
      month++;
    }
  }
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.year}-${String(row.month).padStart(2, '0')}`;
    unique.set(key, row);
  }
  const ordered = [...unique.values()].sort((a, b) => (a.year - b.year) || (a.month - b.month));
  let level = 100;
  return ordered.map((row, index) => {
    level *= (1 + Number(row.monthlyPercent || 0) / 100);
    const date = lastDayOfMonthIso(row.year, row.month);
    const timestamp = `${date}T12:00:00.000Z`;
    return {
      date,
      timestamp,
      time: timestamp,
      close: round(level, 4),
      price: round(level, 4),
      value: round(level, 4),
      monthlyPercent: round(row.monthlyPercent, 4),
      label: `${String(row.month).padStart(2, '0')}/${String(row.year).slice(2)}`,
      source: `${sourceLabel} ${indexCode}`,
      reconstructedFromMonthlyReturns: true,
      synthetic: false,
      simulated: false,
      sequence: index + 1
    };
  }).filter(point => point.date && Number.isFinite(point.close) && point.close > 0);
}

async function fetchMaisRetornoIndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const slugs = MAIS_RETORNO_INDEX_SLUGS[code] || [];
  const attempts = [];
  for (const slug of slugs) {
    const url = `https://maisretorno.com/indice/${encodeURIComponent(slug)}`;
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(payload.timeoutMs || 6200),
      ttlMs: cfg.ttlMs,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 2,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const points = parseMaisRetornoMonthlyReturns(text, code, 'Mais Retorno rentabilidade histórica').slice(-Number(payload.limit || cfg.limit || 320));
    attempts.push({ slug, status, cacheStatus, parsed: points.length, error });
    if (points.length > 1) {
      return {
        status: 'OK',
        ok: true,
        ticker: code,
        index: code,
        range: rangeKey,
        points,
        history: points,
        series: points,
        prices: points,
        chartHistory: points,
        source: `Mais Retorno rentabilidade histórica ${code}`,
        sourceVersion: '21.12.0-mais-retorno-index-monthly-returns-fallback',
        official: false,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        reconstructedFromMonthlyReturns: true,
        cacheStatus,
        statusCode: status,
        diagnostics: attempts,
        warning: `${code} sincronizado por rentabilidade mensal histórica publicada no Mais Retorno; curva acumulada reconstruída a partir de retornos reais, sem ETF/proxy/ticker substituto.`
      };
    }
  }
  return { status: 'EMPTY', ok: false, ticker: code, index: code, points: [], history: [], series: [], prices: [], chartHistory: [], source: `Mais Retorno rentabilidade histórica ${code}`, simulated: false, proxyTickerUsed: false, reconstructedFromMonthlyReturns: false, diagnostics: attempts, error: `Sem histórico mensal suficiente para ${code} no Mais Retorno.` };
}

function yahooChartPointsFromPayload(json, symbol, sourceLabel = 'Yahoo Finance direct index symbol', options = {}) {
  const result = json?.chart?.result?.[0];
  const meta = result?.meta || {};
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const points = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    const close = Number(closes[i]);
    if (Number.isFinite(close) && close > 0) points.push({
      ...toChartPoint(Number(timestamps[i]), close, i),
      source: `${sourceLabel} ${symbol}`
    });
  }

  // Alguns índices diretos da B3 no Yahoo (IFIX.SA, IDIV.SA, SMLL.SA)
  // podem entregar o snapshot em meta.regularMarketPrice mesmo quando a lista
  // quote.close vem vazia/curta. Usamos esse ponto real apenas como snapshot;
  // histórico comparativo continua exigindo pontos reais suficientes.
  if (!points.length) {
    const metaPrice = Number(meta.regularMarketPrice ?? meta.previousClose ?? meta.chartPreviousClose);
    const metaTs = Number(meta.regularMarketTime || timestamps.at(-1) || Math.floor(Date.now() / 1000));
    if (Number.isFinite(metaPrice) && metaPrice > 0) points.push({
      ...toChartPoint(metaTs, metaPrice, 0),
      source: `${sourceLabel} ${symbol} meta`
    });
  }
  if (options.allowSnapshotComparison === true && points.length < 2) {
    const snapshotPoints = yahooSnapshotComparisonPoints(meta, points, symbol);
    if (snapshotPoints.length > points.length) return snapshotPoints;
  }
  return points;
}

function dedupeYahooChartRequests(requests = []) {
  const seen = new Set();
  const out = [];
  for (const item of requests) {
    const range = String(item.range || '').trim();
    const interval = String(item.interval || '').trim();
    if (!range || !interval) continue;
    const key = `${range}|${interval}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ range, interval, reason: item.reason || 'fallback' });
  }
  return out;
}

function yahooIndexChartRequests(rangeKey, payload = {}) {
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const requestedInterval = String(payload.interval || (rangeKey === '1D' ? '1d' : cfg.interval));
  return dedupeYahooChartRequests([
    { range: cfg.range, interval: requestedInterval, reason: 'requested-range' },
    // O APK pede historyMonths=120 para manter o contrato amplo. Para os índices
    // diretos do Yahoo isso pode virar range=10y&interval=1mo, que frequentemente
    // volta vazio. Antes de marcar indisponível, descemos para janelas diárias
    // suportadas pelo Yahoo Finance Chart API.
    { range: '5y', interval: '1wk', reason: 'yahoo-direct-index-compatible-5y' },
    { range: '2y', interval: '1d', reason: 'yahoo-direct-index-compatible-2y' },
    { range: '1y', interval: '1d', reason: 'yahoo-direct-index-compatible-1y' },
    { range: '6mo', interval: '1d', reason: 'yahoo-direct-index-compatible-6mo' },
    { range: '3mo', interval: '1d', reason: 'yahoo-direct-index-compatible-3mo' },
    { range: '1mo', interval: '1d', reason: 'yahoo-direct-index-compatible-1mo' },
    { range: '5d', interval: '1d', reason: 'yahoo-direct-index-compatible-5d' },
    { range: '1d', interval: '1d', reason: 'user-confirmed-snapshot-endpoint' }
  ]);
}

async function fetchDirectYahooIndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const symbols = DIRECT_YAHOO_INDEX_SYMBOLS[code] || [];
  if (!symbols.length) return { status: 'EMPTY', ticker: code, points: [], error: 'direct-yahoo-index-symbol-unavailable' };
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const chartRequests = yahooIndexChartRequests(rangeKey, payload);
  const attempts = [];
  let bestSnapshot = null;
  for (const symbol of symbols) {
    for (const requestCfg of chartRequests) {
      const params = `range=${encodeURIComponent(requestCfg.range)}&interval=${encodeURIComponent(requestCfg.interval)}&includePrePost=false&events=div%2Csplits`;
      for (const host of hosts) {
        const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
        const { json, status, cacheStatus, error, parseError } = await fetchJson(url, {
          timeoutMs: Number(payload.timeoutMs || 6200),
          ttlMs: Number((PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y']).ttlMs || 5 * 60_000),
          staleMs: 24 * 60 * 60 * 1000,
          retries: 2,
          headers: {
            'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
            Accept: 'application/json,text/plain,*/*'
          }
        });
        const points = yahooChartPointsFromPayload(json, symbol, 'Yahoo Finance direct index symbol', { allowSnapshotComparison: requestCfg.range === '1d' && requestCfg.interval === '1d' }).slice(-Number(payload.limit || (PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y']).limit || 320));
        attempts.push({ host, symbol, range: requestCfg.range, interval: requestCfg.interval, reason: requestCfg.reason, status, cacheStatus, parsed: points.length, error: error || (parseError ? 'parse-error' : undefined) });
        if (points.length === 1 && !bestSnapshot) bestSnapshot = { symbol, points, status, cacheStatus, requestCfg };
        if (points.length > 1 || (rangeKey === '1D' && points.length >= 1)) {
          return {
            status: 'OK',
            ok: true,
            ticker: code,
            index: code,
            range: rangeKey,
            yahooRange: requestCfg.range,
            yahooInterval: requestCfg.interval,
            yahooSymbol: symbol,
            points,
            history: points,
            series: points,
            prices: points,
            chartHistory: points,
            source: `Yahoo Finance Chart API índice direto ${symbol}`,
            sourceVersion: '21.12.0-yahoo-direct-index-only-no-i10-fallback-v5',
            official: false,
            directIndexSymbol: true,
            simulated: false,
            proxyTickerUsed: false,
            cacheStatus,
            statusCode: status,
            diagnostics: attempts,
            warning: requestCfg.reason === 'requested-range'
              ? undefined
              : `${code} obtido exclusivamente pelo Yahoo Finance Chart API em janela compatível (${requestCfg.range}/${requestCfg.interval}); sem Investidor10, Mais Retorno, B3, ETF ou proxyTicker.`
          };
        }
      }
    }
  }
  return {
    status: bestSnapshot ? 'SNAPSHOT_ONLY' : 'EMPTY',
    ok: false,
    ticker: code,
    index: code,
    range: rangeKey,
    yahooSymbol: bestSnapshot?.symbol || symbols[0],
    yahooRange: bestSnapshot?.requestCfg?.range,
    yahooInterval: bestSnapshot?.requestCfg?.interval,
    points: bestSnapshot?.points || [],
    history: bestSnapshot?.points || [],
    series: bestSnapshot?.points || [],
    prices: bestSnapshot?.points || [],
    chartHistory: bestSnapshot?.points || [],
    source: `Yahoo Finance Chart API índice direto ${symbols.join(',')}`,
    official: false,
    directIndexSymbol: true,
    simulated: false,
    proxyTickerUsed: false,
    diagnostics: attempts,
    error: bestSnapshot
      ? `Yahoo retornou somente snapshot para ${code}; gráfico comparativo exige pelo menos 2 pontos reais.`
      : `Sem histórico suficiente para ${code} nos símbolos diretos ${symbols.join(', ')}.`
  };
}

function stripHtml(value = '') {
  return String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}

function normalizeLooseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%.,/\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slicePlainSection(text = '', headings = [], stopHeadings = [], maxLen = 7000) {
  const source = String(text || '');
  const normalizedSource = normalizeLooseText(source);
  const normalizedHeadings = headings.map(normalizeLooseText).filter(Boolean);
  let best = -1;
  let used = '';
  for (const heading of normalizedHeadings) {
    const idx = normalizedSource.indexOf(heading);
    if (idx >= 0 && (best < 0 || idx < best)) { best = idx; used = heading; }
  }
  if (best < 0) return '';
  let end = Math.min(source.length, best + maxLen);
  const stops = [
    ...stopHeadings,
    'Histórico de dividendos', 'Radar de dividendos', 'Indicadores', 'Histórico de Indicadores',
    'Receitas e Lucros', 'Lucro x Cotação', 'Resultados', 'Balanço Patrimonial',
    'Negócios que geram receita', 'Regiões onde gera receita', 'Sobre a empresa', 'Comunicados'
  ].map(normalizeLooseText).filter(Boolean).filter(item => item !== used);
  for (const stop of stops) {
    const found = normalizedSource.indexOf(stop, best + used.length + 16);
    if (found >= 0 && found < end) end = found;
  }
  return source.slice(best, end).trim();
}

function parseSimpleHtmlTables(html = '', maxTables = 40) {
  const tables = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  let tableMatch;
  while ((tableMatch = tableRe.exec(String(html || ''))) && tables.length < maxTables) {
    const rows = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableMatch[0])) && rows.length < 200) {
      const cells = [];
      const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[0])) && cells.length < 24) {
        const cell = stripHtml(cellMatch[1]).replace(/\s+/g, ' ').trim();
        if (cell) cells.push(cell);
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push({ index: tables.length, rows });
  }
  return tables;
}

function ownershipRowFromCells(cells = []) {
  const safe = cells.map(cell => stripHtml(cell)).filter(Boolean);
  if (safe.length < 2) return null;
  const joined = safe.join(' ');
  if (/acionista|percentual|participa[cç][aã]o|total/i.test(joined) && !/[0-9][0-9.,]*\s*%/.test(joined)) return null;
  const valueIndex = safe.findIndex(cell => /[0-9][0-9.,]*\s*%/.test(cell));
  if (valueIndex < 0) return null;
  const label = safe.find((cell, index) => index !== valueIndex && !/^[0-9.,%\s]+$/.test(cell));
  const value = safe[valueIndex];
  if (!label || !value) return null;
  return { label: label.slice(0, 90), value, source: 'Investidor10 posição acionária' };
}

function extractInvestidor10OwnershipFromHtml(html = '') {
  const text = stripHtml(html || '');
  const rows = [];
  const seen = new Set();
  const push = (row) => {
    if (!row?.label || !row?.value) return;
    const label = String(row.label || '').replace(/[:•-]+$/g, '').trim();
    if (!label || /^(posi[cç][aã]o acion[aá]ria|acionistas?|percentual|participa[cç][aã]o|total)$/i.test(label)) return;
    if (!/[0-9][0-9.,]*\s*%/.test(String(row.value || ''))) return;
    const key = normalizeLooseText(label);
    if (!key || seen.has(key)) return;
    seen.add(key);
    rows.push({ ...row, label, value: String(row.value).trim() });
  };

  for (const table of parseSimpleHtmlTables(html)) {
    const tableText = table.rows.flat().join(' ');
    if (!/(posi[cç][aã]o acion[aá]ria|acionista|free\s*float|controlador|controladores|a[cç][oõ]es ordin[aá]rias|a[cç][oõ]es preferenciais)/i.test(tableText)) continue;
    for (const cells of table.rows) push(ownershipRowFromCells(cells));
  }

  const section = slicePlainSection(text, ['POSIÇÃO ACIONÁRIA', 'Posição acionária', 'Composição acionária', 'Acionistas'], [], 5000);
  if (section && rows.length < 2) {
    const re = /([A-Za-zÀ-ÿ0-9 .&'’/()_-]{3,80}?)\s+([0-9]{1,3}(?:[.,][0-9]{1,4})?\s*%)/gi;
    let match;
    while ((match = re.exec(section)) && rows.length < 24) {
      const label = match[1]
        .replace(/^(posi[cç][aã]o acion[aá]ria|acionistas?|participa[cç][aã]o|percentual)\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      push({ label, value: match[2], source: 'Investidor10 seção Posição acionária' });
    }
  }

  if (!rows.length) return null;
  return {
    rows,
    keyValues: rows.map(row => ({ label: row.label, value: row.value })),
    source: 'Investidor10 posição acionária',
    text: section ? section.slice(0, 1400) : ''
  };
}

function parseDateLoose(value = '') {
  const raw = stripHtml(value).trim();
  let m = raw.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
  m = raw.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  }
  return '';
}

function parseIndexRowsFromInvestidor10Html(html = '', sourceLabel = 'Investidor10 índice') {
  const rows = [];
  const seen = new Set();
  const add = (date, value) => {
    const close = parseNumberBR(value);
    if (!date || !Number.isFinite(close) || close <= 0 || seen.has(date)) return;
    seen.add(date);
    const millis = Date.parse(`${date}T12:00:00Z`);
    if (!Number.isFinite(millis)) return;
    rows.push({ date, timestamp: new Date(millis).toISOString(), time: new Date(millis).toISOString(), close: round(close, 4), price: round(close, 4), value: round(close, 4), label: date.slice(5, 10).replace('-', '/'), source: sourceLabel });
  };

  for (const tr of String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || []) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => stripHtml(m[1])).filter(Boolean);
    if (cells.length < 2) continue;
    const date = cells.map(parseDateLoose).find(Boolean) || '';
    const numericCells = cells.filter(c => /\d+[,.]\d+/.test(c));
    if (date && numericCells.length) add(date, numericCells.at(-1));
  }

  // Fallback para scripts/JSON embutidos: pares de data ISO ou BR próximos de um valor.
  const compact = String(html || '').replace(/\s+/g, ' ');
  const re = /(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})[^0-9]{0,80}(-?\d{1,3}(?:\.\d{3})*,\d+|-?\d{1,8}\.\d+)/g;
  let match;
  while ((match = re.exec(compact)) && rows.length < 1500) add(parseDateLoose(match[1]), match[2]);

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchInvestidor10IndexHistory(indexCode, rangeKey, payload = {}) {
  const code = String(indexCode || '').trim().toUpperCase();
  const cfg = PERIOD_MAP[rangeKey] || PERIOD_MAP['1Y'];
  const slugs = INVESTIDOR10_INDEX_SLUGS[code] || [];
  const attempts = [];
  for (const slug of slugs) {
    const url = `https://investidor10.com.br/indices/${encodeURIComponent(slug)}/`;
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(payload.timeoutMs || 6200),
      ttlMs: cfg.ttlMs,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 2,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    const points = parseIndexRowsFromInvestidor10Html(text, `Investidor10 índice ${code}`).slice(-Number(payload.limit || cfg.limit || 320));
    attempts.push({ slug, status, cacheStatus, parsed: points.length, error });
    if (points.length > 1) {
      return {
        status: 'OK',
        ok: true,
        ticker: code,
        index: code,
        range: rangeKey,
        points,
        history: points,
        series: points,
        prices: points,
        chartHistory: points,
        source: `Investidor10 índice ${code}`,
        sourceVersion: '21.12.0-investidor10-index-fallback',
        official: false,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        cacheStatus,
        statusCode: status,
        diagnostics: attempts,
        warning: `${code} sincronizado por página de índice do Investidor10; sem ETF/proxy/ticker substituto.`
      };
    }
  }
  return { status: 'EMPTY', ok: false, ticker: code, index: code, points: [], history: [], series: [], prices: [], chartHistory: [], source: `Investidor10 índice ${code}`, simulated: false, proxyTickerUsed: false, diagnostics: attempts, error: `Sem histórico suficiente para ${code} no Investidor10.` };
}

function normalizeRange(range = '1Y') {
  const raw = String(range || '1Y').trim();
  const r = raw.toUpperCase();
  const compact = r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');
  if (r === '1D' || compact === '1DIA' || compact === '1DAY') return '1D';
  if (r === '5D' || compact === '5DIAS' || compact === '5DAYS') return '5D';
  if (r === '1M' || r === '1MO' || compact === '1MO' || compact === '1MES' || compact === '1MONTH') return '1M';
  if (r === '3M' || r === '3MO' || compact === '3MO' || compact === '3MESES' || compact === '3MONTHS') return '3M';
  if (r === '6M' || r === '6MO' || compact === '6MO' || compact === '6MESES' || compact === '6MONTHS') return '6M';
  if (r === 'YTD' || compact === 'YEARSTART' || compact === 'ANO') return 'YTD';
  if (r === '1Y' || r === '1A' || r === '12M' || compact === '1ANO' || compact === '1YEAR') return '1Y';
  if (r === '2Y' || r === '2A' || r === '24M' || compact === '2ANOS' || compact === '2YEARS') return '2Y';
  if (r === '5Y' || r === '5A' || compact === '5ANOS' || compact === '5YEARS') return '5Y';
  if (r === 'MAX' || r === 'ALL' || r === '10Y' || r === 'TUDO' || compact === 'MAXIMO') return 'MAX';
  return PERIOD_MAP[r] ? r : '1Y';
}

function pctChange(start, end) {
  const a = Number(start);
  const b = Number(end);
  return a > 0 && b > 0 ? round(((b - a) / a) * 100, 2) : 0;
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function periodReturnsFromPrices(points = []) {
  const clean = points.filter(p => Number(p.close || p.price || p.value) > 0);
  if (clean.length < 2) return [];
  const last = clean.at(-1)?.close || clean.at(-1)?.price || clean.at(-1)?.value;
  const pick = fraction => clean[Math.max(0, Math.floor((clean.length - 1) * fraction))];
  const rows = [
    ['1M', pick(0.92)],
    ['6M', pick(0.50)],
    ['12M', clean[0]],
    ['Período', clean[0]]
  ];
  const out = [];
  for (const [period, item] of rows) {
    const value = pctChange(item?.close || item?.price || item?.value, last);
    if (value !== 0) out.push({ period, label: period, valuePercent: value, kind: 'nominal' });
  }
  return out;
}

function toChartPoint(timestamp, close, index) {
  const date = timestamp ? new Date(timestamp * 1000).toISOString() : '';
  return {
    date: date.slice(0, 10),
    timestamp: date,
    time: date,
    close: round(close, 4),
    price: round(close, 4),
    value: round(close, 4),
    label: date ? date.slice(5, 10).replace('-', '/') : `P${index + 1}`
  };
}

function addMonthsUtc(date, months) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return d;
}

function yahooSnapshotComparisonPoints(meta = {}, existingPoints = [], symbol = '') {
  const current = Number(
    existingPoints.at(-1)?.close
    ?? existingPoints.at(-1)?.price
    ?? meta.regularMarketPrice
    ?? meta.postMarketPrice
    ?? meta.previousClose
    ?? meta.chartPreviousClose
  );
  const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(previous) || previous <= 0) return [];
  if (Math.abs(current - previous) < 0.000001) return [];

  const currentTs = Number(meta.regularMarketTime || meta.firstTradeDate || Math.floor(Date.now() / 1000));
  const currentDate = Number.isFinite(currentTs) && currentTs > 0 ? new Date(currentTs * 1000) : new Date();
  const previousDate = addMonthsUtc(currentDate, -1);
  const previousTs = Math.floor(previousDate.getTime() / 1000);
  return [
    {
      ...toChartPoint(previousTs, previous, 0),
      source: `Yahoo Finance Chart API índice direto ${symbol} chartPreviousClose`,
      yahooSnapshotComparisonOnly: true,
      reconstructedFromYahooSnapshot: true,
      simulated: false,
      synthetic: false
    },
    {
      ...toChartPoint(Math.floor(currentDate.getTime() / 1000), current, 1),
      source: `Yahoo Finance Chart API índice direto ${symbol} regularMarketPrice`,
      yahooSnapshotComparisonOnly: true,
      reconstructedFromYahooSnapshot: true,
      simulated: false,
      synthetic: false
    }
  ];
}

export async function getAssetHistory(payload = {}) {
  const rawTicker = payload.ticker || payload.symbol || payload.q;
  const ticker = normalizeTicker(rawTicker);
  const rangeKey = normalizeRange(payload.range || payload.period || payload.window || '1Y');
  const officialIndex = officialB3IndexCode(rawTicker, ticker);
  if (!ticker && !officialIndex) return { status: 'EMPTY', ticker: '', points: [], history: [], series: [], chartHistory: [] };
  if (officialIndex) {
    const yahooOnlyIndex = ['IFIX', 'SMLL', 'IDIV'].includes(officialIndex);
    let yahooDirect = null;
    if (yahooOnlyIndex) {
      yahooDirect = await fetchDirectYahooIndexHistory(officialIndex, rangeKey, payload);
      return {
        ...yahooDirect,
        status: yahooDirect.status || 'EMPTY',
        sourcePriority: ['Yahoo Finance Chart API'],
        policy: `${officialIndex} usa exclusivamente Yahoo Finance Chart API com símbolo direto; Investidor10, Mais Retorno, B3 e ETFs/proxyTicker ficam desativados para este índice.`,
        official: false,
        directIndexSymbol: true,
        simulated: false,
        proxyTickerUsed: false,
        yahooOnly: true,
        fallbackAttempt: undefined,
        b3Status: undefined,
        b3Source: undefined,
        b3Error: undefined,
        maisRetornoFallbackAttempt: undefined,
        yahooFallbackAttempt: undefined,
        warning: yahooDirect.status === 'OK'
          ? (yahooDirect.warning || `${officialIndex} sincronizado exclusivamente pelo Yahoo Finance Chart API no símbolo direto ${yahooDirect.yahooSymbol}; sem Investidor10, Mais Retorno, B3, ETF ou proxyTicker.`)
          : (yahooDirect.error || `Yahoo Finance não retornou pontos suficientes para ${officialIndex}; nenhum fallback externo foi usado por política.`)
      };
    }

    const b3 = await fetchB3IndexDailyEvolution(officialIndex, { years: rangeKey === 'MAX' ? 5 : 2, timeoutMs: Number(payload.timeoutMs || 8500), limit: Number(payload.limit || 520), bypassCache: payload.bypassCache === true });
    if (b3.ok && (b3.points || []).length > 1) {
      return {
        ...b3,
        status: 'OK',
        ticker: officialIndex,
        range: rangeKey,
        source: `B3 Oficial - ${officialIndex} daily-evolution`,
        official: true,
        directIndexSymbol: false,
        simulated: false,
        proxyTickerUsed: false,
        yahooPrimaryAttempt: yahooDirect || undefined
      };
    }

    if (!yahooDirect) yahooDirect = await fetchDirectYahooIndexHistory(officialIndex, rangeKey, payload);
    if (yahooDirect.status === 'OK') {
      return {
        ...yahooDirect,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        warning: `B3 oficial sem pontos parseáveis agora; ${officialIndex} sincronizado pela Yahoo Finance Chart API no símbolo direto ${yahooDirect.yahooSymbol}, sem ETF/proxy.`
      };
    }

    // Quando o Yahoo entrega apenas snapshot (ex.: range=1d/interval=1d)
    // o gráfico comparativo ainda precisa de uma curva histórica real. A fonte
    // complementar abaixo usa a tabela pública de rentabilidade mensal do índice,
    // reconstruindo a curva acumulada a partir de retornos publicados — não usa
    // ETF/proxyTicker e não inventa cotação diária.
    const maisRetornoIndex = await fetchMaisRetornoIndexHistory(officialIndex, rangeKey, payload);
    if (maisRetornoIndex.status === 'OK') {
      return {
        ...maisRetornoIndex,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        yahooFallbackAttempt: yahooDirect,
        warning: `Yahoo/B3 sem histórico com 2+ pontos agora; ${officialIndex} sincronizado por rentabilidade mensal real do Mais Retorno, sem ETF/proxy/ticker substituto.`
      };
    }

    const investidor10Index = await fetchInvestidor10IndexHistory(officialIndex, rangeKey, payload);
    if (investidor10Index.status === 'OK') {
      return {
        ...investidor10Index,
        b3Status: b3.status || 'EMPTY',
        b3Source: b3.source || `B3 Oficial - ${officialIndex} daily-evolution`,
        b3Error: b3.error || b3.warning || 'B3 sem pontos suficientes',
        yahooFallbackAttempt: yahooDirect,
        maisRetornoFallbackAttempt: maisRetornoIndex,
        warning: `B3/Yahoo/Mais Retorno sem pontos parseáveis agora; ${officialIndex} sincronizado pela página de índice do Investidor10, sem ETF/proxy.`
      };
    }
    return {
      status: yahooDirect?.status || b3.status || maisRetornoIndex.status || 'EMPTY',
      ok: false,
      ticker: officialIndex,
      index: officialIndex,
      range: rangeKey,
      source: yahooDirect?.source || b3.source || maisRetornoIndex.source || `B3 Oficial - ${officialIndex} daily-evolution`,
      official: false,
      directIndexSymbol: true,
      simulated: false,
      proxyTickerUsed: false,
      points: [],
      history: [],
      series: [],
      prices: [],
      chartHistory: [],
      fallbackAttempt: { yahooDirect, b3, maisRetornoIndex, investidor10Index },
      error: yahooDirect?.error || b3.error || maisRetornoIndex.error || investidor10Index.error || `Sem histórico suficiente para ${officialIndex}.`
    };
  }
  const cfg = PERIOD_MAP[rangeKey];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(ticker))}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false&events=div%2Csplits`;
  const { json, status, cacheStatus, error } = await fetchJson(url, {
    timeoutMs: Number(payload.timeoutMs || 3800),
    ttlMs: cfg.ttlMs,
    staleMs: 24 * 60 * 60 * 1000
  });
  const result = json?.chart?.result?.[0];
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const points = [];
  for (let i = 0; i < Math.min(timestamps.length, closes.length); i++) {
    const close = Number(closes[i]);
    if (Number.isFinite(close) && close > 0) points.push(toChartPoint(Number(timestamps[i]), close, i));
  }
  const limited = points.slice(-Number(payload.limit || cfg.limit));
  return {
    status: limited.length ? 'OK' : 'EMPTY',
    ticker,
    range: rangeKey,
    points: limited,
    history: limited,
    series: limited,
    prices: limited,
    chartHistory: limited,
    source: 'VALORAE Fonte Oficial',
    cacheStatus,
    statusCode: status,
    error: limited.length ? undefined : error
  };
}

const METRIC_LABELS = [
  ['Dividend Yield', ['dividend yield', 'dy']],
  ['P/L', ['p/l', 'preço/lucro', 'preco/lucro']],
  ['PEG Ratio', ['peg ratio', 'peg']],
  ['P/Receita (PSR)', ['p/receita', 'psr', 'preço/receita', 'preco/receita']],
  ['P/VP', ['p/vp', 'pvp']],
  ['Payout', ['payout']],
  ['Margem Líquida', ['margem líquida', 'margem liquida']],
  ['Margem Bruta', ['margem bruta']],
  ['Margem EBIT', ['margem ebit']],
  ['Margem EBITDA', ['margem ebitda']],
  ['EV/EBITDA', ['ev/ebitda']],
  ['EV/EBIT', ['ev/ebit']],
  ['P/EBITDA', ['p/ebitda']],
  ['P/EBIT', ['p/ebit']],
  ['P/Ativo', ['p/ativo']],
  ['P/Cap.Giro', ['p/cap.giro', 'p/cap giro', 'p/capital de giro']],
  ['P/Ativo Circ. Liq.', ['p/ativo circ. liq.', 'p/ativo circulante líquido', 'p/ativo circulante liquido']],
  ['VPA', ['vpa', 'valor patrimonial por ação', 'valor patrimonial por acao', 'valor patrimonial por cota']],
  ['LPA', ['lpa', 'lucro por ação', 'lucro por acao']],
  ['Giro Ativos', ['giro ativos', 'giro de ativos']],
  ['ROE', ['roe']],
  ['ROIC', ['roic']],
  ['ROA', ['roa']],
  ['Dívida Líquida / Patrimônio', ['dívida líquida / patrimônio', 'divida liquida / patrimonio', 'dív. líquida/patrimônio']],
  ['Dívida Líquida / EBITDA', ['dívida líquida / ebitda', 'divida liquida / ebitda', 'dív. líquida/ebitda']],
  ['Dívida Líquida / EBIT', ['dívida líquida / ebit', 'divida liquida / ebit', 'dív. líquida/ebit']],
  ['Dívida Bruta / Patrimônio', ['dívida bruta / patrimônio', 'divida bruta / patrimonio', 'dív. bruta/patrimônio']],
  ['Patrimônio / Ativos', ['patrimônio / ativos', 'patrimonio / ativos']],
  ['Passivos / Ativos', ['passivos / ativos']],
  ['Liquidez Corrente', ['liquidez corrente']],
  ['CAGR Receitas 5 anos', ['cagr receitas 5 anos', 'cagr receita 5 anos']],
  ['CAGR Lucros 5 anos', ['cagr lucros 5 anos', 'cagr lucro 5 anos']],
  ['Liquidez Média Diária', ['liquidez média diária', 'liquidez media diaria']],
  ['Valor de Mercado', ['valor de mercado']],
  ['Patrimônio Líquido', ['patrimônio líquido', 'patrimonio liquido']],
  ['Vacância Física', ['vacância física', 'vacancia fisica']],
  ['Cotistas', ['cotistas']],
  ['Cotas Emitidas', ['cotas emitidas']],
  ['Valor Patrimonial por Cota', ['valor patrimonial por cota', 'val. patrimonial p/ cota', 'vp cota']],
  ['Último Rendimento', ['último rendimento', 'ultimo rendimento']],
  ['Tipo de Fundo', ['tipo de fundo']],
  ['Público-alvo', ['público-alvo', 'publico alvo']],
  ['Taxa de Administração', ['taxa de administração', 'taxa de administracao']]
];

function canonicalKey(label) {
  return String(label || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function extractMetricFromText(text, label, aliases) {
  const compact = String(text || '').replace(/\s+/g, ' ');
  const numeric = '([+-]?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|[+-]?\\d+(?:,\\d+)?)';
  const scale = financialScaleSuffixPattern();
  const suffix = `(?:\\s*(%|x|${scale}))?`;
  const comparisonNumeric = `([+-]?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?|[+-]?\\d+(?:,\\d+)?)(?:\\s*(%|x|${scale}))?`;
  for (const alias of aliases) {
    const safe = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(`${safe}[^0-9+-]{0,80}${numeric}${suffix}`, 'i');
    const match = compact.match(re);
    if (match) {
      const suffixText = (match[2] || '').trim();
      const display = `${match[1]}${suffixText ? `${suffixText === '%' || suffixText === 'x' ? '' : ' '}${suffixText}` : ''}`.replace(/\s+/g, ' ').trim();
      const unit = suffixText === '%' || /yield|roe|roic|roa|margem|payout|vacância|cagr/i.test(label) ? '%' : (suffixText && suffixText !== 'x' ? 'BRL' : '');
      const value = unit === 'BRL' ? numberValueWithScale(display, 0) : numberValue(match[1], 0);
      if (Number.isFinite(value)) {
        const result = { label, value, display, unit };
        const tail = compact.slice(match.index || 0, (match.index || 0) + 420);
        const comparisons = {};
        for (const [key, comparisonLabel] of [['setor', 'Setor'], ['subsetor', 'Subsetor'], ['segmento', 'Segmento']]) {
          const cmp = tail.match(new RegExp(`${comparisonLabel}:\\s*${comparisonNumeric}`, 'i'));
          if (!cmp) continue;
          const cmpSuffix = (cmp[2] || '').trim();
          const cmpDisplay = `${cmp[1]}${cmpSuffix ? `${cmpSuffix === '%' || cmpSuffix === 'x' ? '' : ' '}${cmpSuffix}` : ''}`.replace(/\s+/g, ' ').trim();
          const cmpUnit = cmpSuffix === '%' ? '%' : (cmpSuffix && cmpSuffix !== 'x' ? 'BRL' : unit);
          const cmpValue = cmpUnit === 'BRL' ? numberValueWithScale(cmpDisplay, 0) : numberValue(cmp[1], 0);
          if (!Number.isFinite(cmpValue)) continue;
          comparisons[key] = { label: comparisonLabel, value: cmpValue, display: cmpDisplay, unit: cmpUnit };
        }
        if (Object.keys(comparisons).length) result.comparisons = comparisons;
        return result;
      }
    }
  }
  return null;
}

function parseInvestidor10RelatedCompaniesFromText(text = '') {
  const segment = (text.match(/Empresas\s+Relacionadas\s+([\s\S]{0,2600}?)(?:Comparador\s+entre\s+Ativos|Avaliar\s+a\s+empresa|Hist[oó]rico\s+de\s+Indicadores|D[uú]vidas\s+comuns|$)/i)?.[1] || '').trim();
  if (!segment) return [];
  const rows = [];
  const seen = new Set();
  const metric = String.raw`(?:--|-|[+-]?\d{1,3}(?:\.\d{3})*,\d+%?|[+-]?\d+(?:[.,]\d+)?%?)`;
  const re = new RegExp(String.raw`\b([A-Z]{4}\d{1,2})\s*-\s*([A-ZÀ-Ÿ0-9 .&\-]+?)\s+P\/L:\s*(${metric})\s+P\/VP:\s*(${metric})\s+DY:\s*(${metric})\s+ROE:\s*(${metric})`, 'gi');
  for (const match of segment.matchAll(re)) {
    const ticker = String(match[1] || '').toUpperCase();
    const name = String(match[2] || '').replace(/\s+/g, ' ').trim();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const plDisplay = String(match[3] || '').trim();
    const pvpDisplay = String(match[4] || '').trim();
    const dyDisplay = String(match[5] || '').trim();
    const roeDisplay = String(match[6] || '').trim();
    rows.push({
      ticker,
      symbol: ticker,
      name,
      source: 'Investidor10 Empresas Relacionadas',
      metrics: {
        pl: { label: 'P/L', value: numberValue(plDisplay, NaN), display: plDisplay },
        pvp: { label: 'P/VP', value: numberValue(pvpDisplay, NaN), display: pvpDisplay },
        dividendYield: { label: 'Dividend Yield', value: numberValue(dyDisplay, NaN), display: dyDisplay.endsWith('%') ? dyDisplay : `${dyDisplay}%` },
        roe: { label: 'ROE', value: numberValue(roeDisplay, NaN), display: roeDisplay.endsWith('%') ? roeDisplay : `${roeDisplay}%` }
      }
    });
  }
  return rows;
}

function parseInvestidor10ComparativeGroupsFromText(text = '') {
  const group = {};
  const sector = text.match(/Comparando\s+com\s+Setor:\s*([^.;]+)[.;]/i)?.[1];
  const subSector = text.match(/Comparando\s+com\s+Subsetor:\s*([^.;]+)[.;]/i)?.[1];
  const segment = text.match(/Comparando\s+com\s+Segmento:\s*([^.;]+)[.;]/i)?.[1];
  if (sector) group.sector = sector.replace(/\s+/g, ' ').trim();
  if (subSector) group.subSector = subSector.replace(/\s+/g, ' ').trim();
  if (segment) group.segment = segment.replace(/\s+/g, ' ').trim();
  return group;
}

function parseMetricsFromHtml(html = '') {
  if (!html) return { indicators: {}, indicatorCards: [], profile: {}, relatedCompanies: [], comparativeGroups: {} };
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  const indicators = {};
  const indicatorCards = [];
  for (const [label, aliases] of METRIC_LABELS) {
    const found = extractMetricFromText(text, label, aliases);
    if (found && !indicatorCards.some(x => x.label === label)) {
      indicatorCards.push(found);
      const key = canonicalKey(label).replace(/(^|\s)([a-z0-9])/g, (_, a, b) => a ? b.toUpperCase() : b).replace(/\s+/g, '');
      const mapKey = {
        'dividendYield': 'dividendYield', 'pL': 'pl', 'pl': 'pl', 'pegRatio': 'pegRatio', 'peg': 'pegRatio', 'pReceitaPsr': 'psr', 'psr': 'psr', 'pVP': 'pvp', 'pVp': 'pvp', 'pvp': 'pvp',
        'payout': 'payout', 'margemLiquida': 'margemLiquida', 'margemBruta': 'margemBruta',
        'margemEbit': 'margemEbit', 'margemEbitda': 'margemEbitda', 'evEbitda': 'evEbitda',
        'evEbit': 'evEbit', 'pEbitda': 'pEbitda', 'pEbit': 'pEbit', 'pAtivo': 'pAtivo',
        'pCapGiro': 'pCapGiro', 'pAtivoCircLiq': 'pAtivoCircLiq', 'vpa': 'vpa', 'lpa': 'lpa',
        'giroAtivos': 'giroAtivos', 'roe': 'roe', 'roic': 'roic', 'roa': 'roa',
        'dividaLiquidaPatrimonio': 'dividaLiquidaPatrimonio', 'dividaLiquidaEbitda': 'dividaLiquidaEbitda',
        'dividaLiquidaEbit': 'dividaLiquidaEbit', 'dividaBrutaPatrimonio': 'dividaBrutaPatrimonio',
        'patrimonioAtivos': 'patrimonioAtivos', 'passivosAtivos': 'passivosAtivos',
        'liquidezCorrente': 'liquidezCorrente', 'cagrReceitas5Anos': 'cagrReceitas5Anos',
        'cagrLucros5Anos': 'cagrLucros5Anos', 'valorDeMercado': 'valorDeMercado',
        'patrimonioLiquido': 'patrimonioLiquido', 'liquidezMediaDiaria': 'liquidezMediaDiaria',
        'vacanciaFisica': 'vacanciaFisica', 'cotasEmitidas': 'cotasEmitidas'
      }[key] || key.charAt(0).toLowerCase() + key.slice(1);
      indicators[mapKey] = found.value;
    }
  }
  const descriptionMatch = text.match(/(?:Sobre|Quem é|Perfil)\s+(.{40,380}?)(?:Indicadores|Cotação|Dividend|Últimos|Fundamentos|$)/i);
  const relatedCompanies = parseInvestidor10RelatedCompaniesFromText(text);
  const comparativeGroups = parseInvestidor10ComparativeGroupsFromText(text);
  return {
    indicators,
    indicatorCards,
    profile: { description: descriptionMatch?.[1]?.trim() || '', ...comparativeGroups },
    comparativeGroups,
    relatedCompanies,
    peerFundamentalComparator: relatedCompanies
  };
}



function extractStatusInvestFiiPortfolioFromHtml(html = '') {
  if (!html) return [];
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const start = plain.search(/PORTF[ÓO]LIO|DISTRIBUI[ÇC][ÃA]O POR ESTADO|VAC[ÂA]NCIA/i);
  if (start < 0) return [];
  const sec = plain.slice(start, start + 9000);
  const out = [];
  const propertyRe = /(?:flip_to_back\s*)?([\d.]+,\d{2}\s*m²)\s+([A-Za-zÀ-ÿ0-9 .'-]{2,80})\s+VAC[ÂA]NCIA\s+([\d.,]+%)\s+Inadimpl[êe]ncia\s+([\d.,]+%)\s+(?:[A-Z]{2}\s+)?OBJETIVO\s+([A-Za-zÀ-ÿ ]{3,40})/gi;
  let m;
  while ((m = propertyRe.exec(sec)) && out.length < 80) {
    const area = String(m[1] || '').trim();
    const cidade = String(m[2] || '').trim();
    const vacancia = String(m[3] || '').trim();
    const inadimplencia = String(m[4] || '').trim();
    const objetivo = String(m[5] || '').replace(/\s+(?:ABL|ÁREA|AREA|CAP RATE|CONTRATO).*$/i, '').trim();
    if (!cidade || !area) continue;
    out.push({
      nome: cidade,
      cidade,
      area_bruta_locavel: area,
      vacancia,
      inadimplencia,
      objetivo,
      tipo: 'imovel',
      source: 'StatusInvestHTML.portfolioFii'
    });
  }
  return out;
}


function htmlToPlainText(html = '') {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#37;/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

function financialScaleSuffixPattern() {
  return '(?:\\btri(?:lh(?:ã|a)o|lh(?:õ|o)es)?\\b(?![A-Za-zÀ-ÿ])|\\btrilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\btrilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bbilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\bbilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bbi\\b(?![A-Za-zÀ-ÿ])|\\bmilh(?:ã|a)o\\b(?![A-Za-zÀ-ÿ])|\\bmilh(?:õ|o)es\\b(?![A-Za-zÀ-ÿ])|\\bmi\\b(?![A-Za-zÀ-ÿ])|\\bmil\\b(?![A-Za-zÀ-ÿ])|\\b[KMBT]\\b(?![A-Za-zÀ-ÿ]))';
}


function numberValueWithScale(value, fallback = 0) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  const lower = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let multiplier = 1;
  if (/\b(trilhao|trilhoes|tri|t)\b/.test(lower)) multiplier = 1e12;
  else if (/\b(bilhao|bilhoes|bi|b)\b/.test(lower)) multiplier = 1e9;
  else if (/\b(milhao|milhoes|mi|m)\b/.test(lower)) multiplier = 1e6;
  else if (/\b(mil|k)\b/.test(lower)) multiplier = 1e3;
  const cleaned = raw
    .replace(/R\$|US\$/gi, '')
    .replace(/%/g, '')
    .replace(/trilh(?:a|ã)o(?:es|ões)?|trilhoes|trilhões|tri|bilh(?:a|ã)o(?:es|ões)?|bilhoes|bilhões|bi|milh(?:a|ã)o(?:es|ões)?|milhoes|milhões|mi|mil|[KMBT]/gi, '')
    .trim();
  const parsed = numberValue(cleaned, NaN);
  return Number.isFinite(parsed) ? parsed * multiplier : fallback;
}
function firstDisplayValueAfterLabel(plain = '', label = '', options = {}) {
  const source = String(plain || '');
  const start = source.toLowerCase().indexOf(String(label || '').toLowerCase());
  if (start < 0) return '';
  const slice = source.slice(start + String(label || '').length, start + String(label || '').length + Number(options.window || 180));
  const scale = financialScaleSuffixPattern();
  const money = slice.match(new RegExp(String.raw`R\$\s*[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?(?:\s*${scale})?`, 'i'));
  const percent = slice.match(/[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%/);
  const scaledNumber = slice.match(new RegExp(String.raw`[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*${scale}`, 'i'));
  const number = slice.match(/[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:,\d+)?/);
  if (options.preferPercent && percent) return percent[0].trim();
  if (options.preferMoney && money) return money[0].replace(/\s+/g, ' ').trim();
  const candidates = [money, percent, scaledNumber, number].filter(Boolean).sort((a, b) => a.index - b.index);
  return candidates[0]?.[0]?.replace(/\s+/g, ' ').trim() || '';
}

function extractInvestidor10ValuationModelsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const out = {};
  const grahamStart = plain.search(/Preço\s+Justo\s+de\s+Graham/i);
  if (grahamStart >= 0) {
    const sec = plain.slice(grahamStart, grahamStart + 1200);
    const current = sec.match(/Preço\s+Atual\s*(R\$\s*[\d.,]+)/i);
    const fair = sec.match(/Preço\s+Justo(?!\s+de\s+Graham)\s*(R\$\s*[\d.,]+)/i);
    const upside = sec.match(/(?:Upside|Potencial)[^\d+-]{0,80}([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i);
    out.grahamFairPrice = fair?.[1]?.trim() || '';
    out.grahamCurrentPrice = current?.[1]?.trim() || '';
    out.grahamUpside = upside?.[1]?.trim() || '';
  }
  const bazinStart = plain.search(/Preço[-\s]?teto\s+de\s+Bazin|Bazin/i);
  if (bazinStart >= 0) {
    const sec = plain.slice(bazinStart, bazinStart + 1400);
    const current = sec.match(/Preço\s+Atual\s*(R\$\s*[\d.,]+)/i);
    const ceiling = sec.match(/Preço[-\s]?teto(?!\s+de\s+Bazin)\s*(R\$\s*[\d.,]+)/i);
    const upside = sec.match(/(?:Upside|Potencial)[^\d+-]{0,80}([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i);
    const dy = sec.match(/(?:DY\s*mínimo|Dividend\s*Yield\s*Desejado)[^\d+-]{0,80}([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i);
    out.bazinCeilingPrice = ceiling?.[1]?.trim() || '';
    out.bazinCurrentPrice = current?.[1]?.trim() || '';
    out.bazinUpside = upside?.[1]?.trim() || '';
    out.bazinMinimumDy = dy?.[1]?.trim() || '';
  }
  return Object.fromEntries(Object.entries(out).filter(([, value]) => String(value || '').trim() && !/^0(?:,00)?%?$/.test(String(value).trim())));
}

function extractStatusInvestFiiHighlightsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const fields = [
    ['dyCagr3', 'DY CAGR (3 anos)', { preferPercent: true }],
    ['dyCagr5', 'DY CAGR (5 anos)', { preferPercent: true }],
    ['valorCagr3', 'Valor CAGR (3 anos)', { preferPercent: true }],
    ['valorCagr5', 'Valor CAGR (5 anos)', { preferPercent: true }],
    ['numeroCotistas', 'Nº de Cotistas', {}],
    ['cotasEmitidas', 'Nº de Cotas', {}],
    ['rendimentoMedio24m', 'RENDIMENTO MENSAL MÉDIO (24M)', { preferMoney: true }],
    ['liquidezMediaDiaria', 'Liquidez média diária', { preferMoney: true }],
    ['participacaoIfix', 'PARTICIPAÇÃO NO IFIX', { preferPercent: true }]
  ];
  const out = {};
  for (const [key, label, opts] of fields) {
    const value = firstDisplayValueAfterLabel(plain, label, { ...opts, window: 260 });
    if (value) out[key] = value;
  }
  return out;
}

function extractStatusInvestFiiAccountingFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const labels = [
    ['numeroCotistas', 'Número cotistas'],
    ['cotasEmitidas', 'Número cotas emitidas'],
    ['ativos', 'Ativos - (R$)', { preferMoney: true }],
    ['patrimonioLiquido', 'Patrimônio Líquido - (R$)', { preferMoney: true }],
    ['valorPatrimonialCota', 'Valor Patrimonial da Cota - (R$)', { preferMoney: true }],
    ['despesasTaxaAdministracao', 'Despesas Taxa Administração - (R$)', { preferMoney: true }],
    ['despesasAgenteCustodiante', 'Despesas Agente Custodiante - (R$)', { preferMoney: true }],
    ['rentabilidadeEfetivaMensal', 'Rentabilidade Efetiva Mensal - (%)', { preferPercent: true }],
    ['rentabilidadePatrimonial', 'Rentabilidade Patrimonial do Período - (%)', { preferPercent: true }],
    ['dividendYield', 'Dividend Yield do Período - (%)', { preferPercent: true }],
    ['amortizacoes', 'Amortizações do Período - (R$)', { preferMoney: true }],
    ['totalNecessidadeLiquidez', 'Total Necessidade Líquidez - (R$)', { preferMoney: true }],
    ['disponibilidades', 'Disponibilidades - (R$)', { preferMoney: true }],
    ['titulosPublicos', 'Títulos Públicos - (R$)', { preferMoney: true }],
    ['titulosPrivados', 'Títulos Privados - (R$)', { preferMoney: true }],
    ['fundosRendaFixa', 'Fundos Renda Fixa - (R$)', { preferMoney: true }],
    ['totalInvestido', 'Total Investido - (R$)', { preferMoney: true }],
    ['bensDireitosImoveis', 'Bens e Direitos Imóveis - (R$)', { preferMoney: true }],
    ['terrenos', 'Terrenos - (R$)', { preferMoney: true }],
    ['imoveisRendaAcabados', 'Imóveis Renda Acabados - (R$)', { preferMoney: true }],
    ['imoveisRendaConstrucao', 'Imóveis Renda em Construção - (R$)', { preferMoney: true }],
    ['imoveisVendaAcabados', 'Imóveis Venda Acabados - (R$)', { preferMoney: true }],
    ['imoveisVendaConstrucao', 'Imóveis Venda em Construção - (R$)', { preferMoney: true }],
    ['outrosBensDireitos', 'Outros Bens e Direitos - (R$)', { preferMoney: true }],
    ['acoes', 'Ações - (R$)', { preferMoney: true }],
    ['debentures', 'Debêntures - (R$)', { preferMoney: true }],
    ['bonusSubscricao', 'Bônus de Subscrição - (R$)', { preferMoney: true }],
    ['certificadosDepositosValoresMobiliarios', 'Certificados de Depósitos de Valores Mobiliários - (R$)', { preferMoney: true }],
    ['cedulasDebentures', 'Cédulas de Debêntures - (R$)', { preferMoney: true }],
    ['fundoAcoesFia', 'Fundo de Ações (FIA) - (R$)', { preferMoney: true }],
    ['fundoInvestimentoParticipacoesFip', 'Fundo de Investimento em Participações (FIP) - (R$)', { preferMoney: true }],
    ['fiiInvestidos', 'FII - (R$)', { preferMoney: true }],
    ['fidc', 'FIDC - (R$)', { preferMoney: true }],
    ['outrasCotasFundosInvestimento', 'Outras Cotas de Fundos de Investimento - (R$)', { preferMoney: true }],
    ['notasPromissorias', 'Notas Promissórias - (R$)', { preferMoney: true }],
    ['acoesSociedadesPropositoFii', 'Ações de Sociedades cujo único propósito se enquadre entre as atividades permitidas aos FII - (R$)', { preferMoney: true }],
    ['cotasSociedadesFii', 'Cotas de Sociedades que se enquadre entre as atividades permitidas aos FII - (R$)', { preferMoney: true }],
    ['cepac', 'Certificados de Potencial Adicional de Construção (CEPAC) - (R$)', { preferMoney: true }],
    ['cri', 'Certificados de Recebíveis Imobiliários (CRI) - (R$)', { preferMoney: true }],
    ['letrasHipotecarias', 'Letras Hipotecárias - (R$)', { preferMoney: true }],
    ['lci', 'Letras de Crédito Imobiliário (LCI) - (R$)', { preferMoney: true }],
    ['lig', 'Letras Imobiliárias Garantidas (LIG) - (R$)', { preferMoney: true }],
    ['outrosValoresMobiliarios', 'Outros Valores Mobiliários - (R$)', { preferMoney: true }],
    ['valoresReceber', 'Valores a Receber - (R$)', { preferMoney: true }],
    ['contasReceberAlugueis', 'Contas a Receber por Aluguéis - (R$)', { preferMoney: true }],
    ['contasReceberVendaImoveis', 'Contas a Receber por Venda de Imóveis - (R$)', { preferMoney: true }],
    ['outrosValoresReceber', 'Outros Valores a Receber - (R$)', { preferMoney: true }],
    ['valoresPagar', 'Valores a Pagar - (R$)', { preferMoney: true }],
    ['rendimentosDistribuir', 'Rendimentos a Distribuir - (R$)', { preferMoney: true }],
    ['taxaAdministracaoPagar', 'Taxa Administração a Pagar - (R$)', { preferMoney: true }],
    ['taxaPerformancePagar', 'Taxa Performance a Pagar - (R$)', { preferMoney: true }],
    ['obrigacoesAquisicaoImoveis', 'Obrigações por Aquisição de Imóveis - (R$)', { preferMoney: true }],
    ['adiantamentoVendaImoveis', 'Adiantamento por venda de imóveis - (R$)', { preferMoney: true }],
    ['adiantamentoAlugueis', 'Adiantamento de valores de aluguéis - (R$)', { preferMoney: true }],
    ['obrigacoesSecuritizacaoRecebiveis', 'Obrigações por securitização de recebíveis - (R$)', { preferMoney: true }],
    ['instrumentosFinanceirosDerivativos', 'Instrumentos financeiros derivativos - (R$)', { preferMoney: true }],
    ['provisoesContingencias', 'Provisões para contingências - (R$)', { preferMoney: true }],
    ['outrosValoresPagar', 'Outros valores a pagar - (R$)', { preferMoney: true }]
  ];
  const out = {};
  for (const [key, label, opts = {}] of labels) {
    const value = firstDisplayValueAfterLabel(plain, label, { ...opts, window: 220 });
    if (value) out[key] = value;
  }
  return out;
}

function extractStatusInvestIndicesFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const indicesStart = plain.search(/[ÍI]NDICES\s+COM/i);
  const participationStart = plain.search(/PARTICIPAÇÃO\s+NO\s+IFIX/i);
  const start = indicesStart >= 0 ? indicesStart : participationStart;
  if (start < 0) return [];
  const sec = plain.slice(start, start + 3500);
  const rows = [];
  const seen = new Set();
  const knownRe = /\b(IFIX|IBOV|SMLL|IDIV|XPFI|XPFT|SNFI|BDRX|ICON|IMOB|IFNC)\b[\s\S]{0,120}?PARTICIPA[ÇC][ÃA]O\s*([\d.,]+)\s*%/gi;
  let known;
  while ((known = knownRe.exec(sec)) && rows.length < 24) {
    const code = String(known[1] || '').trim().toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    rows.push({ ticker: code, name: code, participacao: `${String(known[2] || '').trim()}%`, source: 'StatusInvestHTML.indices' });
  }
  const re = /\b([A-Z]{3,6})\b(?=[\s\S]{0,180}?PARTICIPA[ÇC][ÃA]O)[\s\S]{0,220}?PARTICIPA[ÇC][ÃA]O\s*([\d.,]+)\s*%/gi;
  let m;
  while ((m = re.exec(sec)) && rows.length < 24) {
    const code = String(m[1] || '').trim().toUpperCase();
    if (!code || ['FII', 'FIA', 'CAGR', 'NDICES', 'INDICES', 'COM', 'NUMERO'].includes(code) || seen.has(code)) continue;
    seen.add(code);
    rows.push({ ticker: code, name: code, participacao: `${String(m[2] || '').trim()}%`, source: 'StatusInvestHTML.indices' });
  }
  if (!rows.length) {
    const ifix = firstDisplayValueAfterLabel(sec, 'PARTICIPAÇÃO NO IFIX', { preferPercent: true, window: 260 });
    if (ifix) rows.push({ ticker: 'IFIX', name: 'IFIX', participacao: ifix, source: 'StatusInvestHTML.indices' });
  }
  return rows;
}

function cleanDeepDisplay(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}


function textValueAfterLabel(plain = '', label = '', stopLabels = [], window = 220) {
  const source = String(plain || '');
  const lower = source.toLowerCase();
  const labelLower = String(label || '').toLowerCase();
  const start = lower.indexOf(labelLower);
  if (start < 0) return '';
  const raw = source.slice(start + String(label || '').length, start + String(label || '').length + Number(window || 220));
  const rawLower = raw.toLowerCase();
  let end = raw.length;
  for (const stop of stopLabels || []) {
    const needle = String(stop || '').toLowerCase();
    if (!needle) continue;
    const idx = rawLower.indexOf(needle);
    if (idx >= 0 && idx < end) end = idx;
  }
  return cleanDeepDisplay(raw.slice(0, end)).replace(/^[:\-–—•]+\s*/g, '').trim();
}

function addDeepFact(rows, seen, id, label, rawValue, group = 'Dados úteis da fonte', source = 'StatusInvest/Investidor10') {
  const value = cleanDeepDisplay(rawValue);
  if (!value || value === '-' || value === '--' || /^null|undefined$/i.test(value)) return;
  if (/^(0|0,0+|R\$\s*0(?:,00)?|0\s*%)$/i.test(value)) return;
  const key = `${id || label}|${value}`.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ id: id || canonicalKey(label).replace(/\s+/g, '_'), label, value, group, source });
}

function extractStatusInvestStockDeepFieldsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const rows = [];
  const profile = {};
  const indicators = {};
  const seen = new Set();
  const fields = [
    ['assetKind', 'Tipo', 'Cadastro', { text: true, stops: ['Tag Along', 'Liq. méd. diária', 'Liquidez média diária', 'PART. IBOV', 'MERCADO DE OPÇÕES', 'Volatilidade histórica'] }, 'profile'],
    ['tagAlong', 'Tag Along', 'Governança', { preferPercent: true }, 'both'],
    ['dailyLiquidity', 'Liq. méd. diária', 'Liquidez', { preferMoney: true }, 'both'],
    ['ibovParticipation', 'PART. IBOV', 'Índices', { preferPercent: true }, 'both'],
    ['openOptions', 'MERCADO DE OPÇÕES', 'Mercado', { text: true, stops: ['aluguel de ações', 'DATA BASE', 'Subscrição', 'Eventos'] }, 'profile'],
    ['historicalVolatility', 'Volatilidade histórica', 'Risco', { preferPercent: true }, 'both'],
    ['min52Weeks', 'Min. 52 semanas', 'Faixa de preço', { preferMoney: true }, 'both'],
    ['minMonth', 'Min. mês', 'Faixa de preço', { preferMoney: true }, 'both'],
    ['max52Weeks', 'Máx. 52 semanas', 'Faixa de preço', { preferMoney: true }, 'both'],
    ['maxMonth', 'Máx. mês', 'Faixa de preço', { preferMoney: true }, 'both'],
    ['valuation12m', 'Valorização (12m)', 'Desempenho', { preferPercent: true }, 'both'],
    ['monthVariation', 'Mês atual', 'Desempenho', { preferPercent: true }, 'both']
  ];
  for (const [id, label, group, opts, target] of fields) {
    const value = opts?.text
      ? textValueAfterLabel(plain, label, opts.stops || [], opts.window || 260)
      : firstDisplayValueAfterLabel(plain, label, { ...opts, window: 360 });
    if (!value) continue;
    addDeepFact(rows, seen, id, label.replace('Liq. méd. diária', 'Liquidez média diária').replace('PART. IBOV', 'Participação no IBOV'), value, group, 'StatusInvestHTML.mercadoGovernanca');
    if (target === 'profile' || target === 'both') profile[id] = value;
    if (target === 'both') indicators[id] = value;
  }
  return { rows, profile, indicators };
}


function extractStatusInvestStockLendingFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/aluguel\s+de\s+a[çc][õo]es/i);
  if (start < 0) return [];
  const sec = plain.slice(start, start + 1800);
  const rows = [];
  const seen = new Set();
  const dataBase = sec.match(/DATA\s+BASE\s*-?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1];
  const tomador = sec.match(/TOMADOR\s*\(m[eé]dia\)\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i)?.[1];
  const doador = sec.match(/DOADOR\s*\(m[eé]dia\)\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i)?.[1];
  const ranges = [...sec.matchAll(/MIN\.\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)\s*MAX\.\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/gi)];
  addDeepFact(rows, seen, 'stock_lending_base_date', 'Data base do aluguel', dataBase, 'Aluguel de ações', 'StatusInvestHTML.aluguelAcoes');
  addDeepFact(rows, seen, 'stock_lending_borrower_avg', 'Tomador média', tomador, 'Aluguel de ações', 'StatusInvestHTML.aluguelAcoes');
  if (ranges[0]) addDeepFact(rows, seen, 'stock_lending_borrower_range', 'Faixa tomador', `Min. ${ranges[0][1]} • Max. ${ranges[0][2]}`, 'Aluguel de ações', 'StatusInvestHTML.aluguelAcoes');
  addDeepFact(rows, seen, 'stock_lending_lender_avg', 'Doador média', doador, 'Aluguel de ações', 'StatusInvestHTML.aluguelAcoes');
  if (ranges[1]) addDeepFact(rows, seen, 'stock_lending_lender_range', 'Faixa doador', `Min. ${ranges[1][1]} • Max. ${ranges[1][2]}`, 'Aluguel de ações', 'StatusInvestHTML.aluguelAcoes');
  return rows;
}

function extractStatusInvestFiiDividendSnapshotFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const rows = [];
  const seen = new Set();
  const current = slicePlainSection(plain, ['Último rendimento'], ['Próximo Rendimento', 'DIVIDENDOS DO', 'Ano passado'], 900);
  if (current) {
    addDeepFact(rows, seen, 'fii_last_income_value', 'Último rendimento', firstDisplayValueAfterLabel(current, 'Último rendimento', { preferMoney: true, window: 180 }), 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
    addDeepFact(rows, seen, 'fii_last_income_yield', 'Rendimento do último pagamento', firstDisplayValueAfterLabel(current, 'Rendimento', { preferPercent: true, window: 160 }), 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
    addDeepFact(rows, seen, 'fii_last_income_base_quote', 'Cotação base do último rendimento', firstDisplayValueAfterLabel(current, 'Cotação base', { preferMoney: true, window: 160 }), 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
    addDeepFact(rows, seen, 'fii_last_income_base_date', 'Data base do último rendimento', firstDisplayValueAfterLabel(current, 'Data Base', { window: 160 }), 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
    addDeepFact(rows, seen, 'fii_last_income_payment_date', 'Data de pagamento do último rendimento', firstDisplayValueAfterLabel(current, 'Data Pagamento', { window: 160 }), 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
  }
  const yearly = plain.match(/Ano\s+passado\s+(R\$\s*[\d.,]+)[\s\S]{0,180}?Ano\s+atual\s+(R\$\s*[\d.,]+)/i);
  if (yearly) {
    addDeepFact(rows, seen, 'fii_income_previous_year', 'Rendimentos no ano passado', yearly[1], 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
    addDeepFact(rows, seen, 'fii_income_current_year', 'Rendimentos no ano atual', yearly[2], 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
  }
  const provisioned = firstDisplayValueAfterLabel(plain, 'Provisionado', { preferMoney: true, window: 220 });
  if (provisioned) addDeepFact(rows, seen, 'fii_income_provisioned', 'Rendimento provisionado', provisioned, 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
  const provisionedComparison = plain.match(/Comparação\s*\+\s*Provisionado\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*%)/i)?.[1];
  if (provisionedComparison) addDeepFact(rows, seen, 'fii_income_provisioned_comparison', 'Comparação + provisionado', provisionedComparison, 'Rendimentos', 'StatusInvestHTML.rendimentosFii');
  return rows;
}

function extractInvestidor10FiiInfoFactsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/INFORMA[ÇC][ÕO]ES\s+SOBRE\s+[A-Z0-9]{4,8}/i);
  if (start < 0) return { info: {}, rows: [] };
  const sec = plain.slice(start, start + 1800);
  const pairs = [
    ['razaoSocial', 'Razão Social', 'Cadastro'],
    ['cnpj', 'CNPJ', 'Cadastro'],
    ['publicoAlvo', 'PÚBLICO-ALVO', 'Cadastro'],
    ['mandato', 'MANDATO', 'Classificação'],
    ['segmento', 'SEGMENTO', 'Classificação'],
    ['tipoFundo', 'TIPO DE FUNDO', 'Classificação'],
    ['prazoDuracao', 'PRAZO DE DURAÇÃO', 'Cadastro'],
    ['tipoGestao', 'TIPO DE GESTÃO', 'Gestão'],
    ['taxaAdministracao', 'TAXA DE ADMINISTRAÇÃO', 'Custos'],
    ['vacancia', 'VACÂNCIA', 'Portfólio'],
    ['numeroCotistas', 'NUMERO DE COTISTAS', 'Base de cotistas'],
    ['cotasEmitidas', 'COTAS EMITIDAS', 'Base patrimonial'],
    ['valorPatrimonialCota', 'VAL. PATRIMONIAL P/ COTA', 'Patrimônio'],
    ['valorPatrimonial', 'VALOR PATRIMONIAL', 'Patrimônio'],
    ['ultimoRendimento', 'ÚLTIMO RENDIMENTO', 'Rendimentos']
  ];
  const info = {};
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < pairs.length; i++) {
    const [id, label, group] = pairs[i];
    const nextLabels = pairs.slice(i + 1).map(([, next]) => next.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([\\s\\S]*?)(?=${nextLabels || 'HIST[ÓO]RICO'}|HIST[ÓO]RICO|COMPARA[ÇC][ÃA]O|$)`, 'i');
    const value = cleanDeepDisplay(sec.match(re)?.[1] || '').replace(/\s+help_outline$/i, '').trim();
    if (!value || value.length > 160) continue;
    info[id] = value;
    addDeepFact(rows, seen, `i10_fii_${id}`, label.replace('NUMERO', 'NÚMERO').replace('VAL.', 'Valor'), value, group, 'Investidor10HTML.informacoesSobreFii');
  }
  return { info, rows };
}

function extractStatusInvestCalendarEventsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/EVENTOS\s+DO\s+[A-Z0-9]{4,8}/i);
  if (start < 0) return [];
  const sec = plain.slice(start, start + 1800);
  if (/N[ãa]o\s+h[áa]\s+eventos\s+para\s+este\s+dia/i.test(sec) && !/COMUNICADO\s+\d{1,2}\/\d{1,2}/i.test(sec)) return [];
  const rows = [];
  const seen = new Set();
  const month = sec.match(/(JANEIRO|FEVEREIRO|MAR[ÇC]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO),\s*(\d{4})/i);
  addDeepFact(rows, seen, 'calendar_reference', 'Calendário de eventos', month ? `${month[1]} ${month[2]}` : 'Disponível na fonte', 'Eventos do ativo', 'StatusInvestHTML.eventosCalendario');
  const re = /(COMUNICADOS?|PROVENTO|PAGAMENTO|EVENTOS?|IPO|FERIADO)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)[\s:-]+([^•]{3,120})/gi;
  let m;
  while ((m = re.exec(sec)) && rows.length < 12) {
    addDeepFact(rows, seen, `calendar_${rows.length}`, cleanDeepDisplay(m[1]), `${m[2]} • ${cleanDeepDisplay(m[3])}`, 'Eventos do ativo', 'StatusInvestHTML.eventosCalendario');
  }
  return rows;
}

function extractStatusInvestCorporateEventsFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const events = [];
  const seen = new Set();
  const push = (id, label, value, group = 'Eventos corporativos', source = 'StatusInvestHTML.eventos') => {
    const text = cleanDeepDisplay(value);
    if (!text || text === '-' || text === '--') return;
    const key = `${label}|${text}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    events.push({ id, label, value: text, group, source });
  };
  const splitStart = plain.search(/DESDOBRAMENTO\/?GRUPAMENTO|DESDOBRAMENTO|GRUPAMENTO/i);
  if (splitStart >= 0) {
    const sec = plain.slice(splitStart, splitStart + 1300);
    const dataCom = firstDisplayValueAfterLabel(sec, 'Data COM', { window: 140 });
    const fator = firstDisplayValueAfterLabel(sec, 'Fator', { window: 160 });
    const dataAnuncio = firstDisplayValueAfterLabel(sec, 'Data do anúncio', { window: 140 });
    push('split_announcement_date', 'Anúncio de split/grupamento', dataAnuncio);
    push('split_com_date', 'Data COM do split/grupamento', dataCom);
    push('split_factor', 'Fator do split/grupamento', fator);
  }
  const subStart = plain.search(/SUBSCRI[ÇC][ÃA]O/i);
  if (subStart >= 0) {
    const sec = plain.slice(subStart, subStart + 2400);
    const fields = [
      ['subscription_announcement', 'Anúncio'],
      ['subscription_com_date', 'DATA COM'],
      ['subscription_trading', 'Negociação'],
      ['subscription_deadline', 'Fim de subscrição'],
      ['subscription_base_value', 'Valor base'],
      ['subscription_percent', 'Percentual'],
      ['subscription_asset', 'Ativo emitido']
    ];
    for (const [id, label] of fields) {
      const value = firstDisplayValueAfterLabel(sec, label, { window: 260, preferMoney: /valor/i.test(label), preferPercent: /percentual/i.test(label) });
      push(id, label === 'Anúncio' ? 'Anúncio de subscrição' : label, value);
    }
  }
  return events.slice(0, 24);
}

function extractStatusInvestFiiProfileDeepFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const profile = {};
  const rows = [];
  const seen = new Set();
  const fields = [
    ['cnpj', 'CNPJ', 'Cadastro'],
    ['tradingName', 'Nome Pregão', 'Cadastro'],
    ['fundStartDate', 'Ínicio do fundo', 'Cadastro'],
    ['fundStartDate', 'Início do fundo', 'Cadastro'],
    ['term', 'Prazo de duração', 'Cadastro'],
    ['anbimaType', 'Tipo ANBIMA', 'Classificação'],
    ['anbimaSegment', 'Segmento ANBIMA', 'Classificação'],
    ['administrator', 'Administrador', 'Gestão'],
    ['phone', 'Telefone', 'Contato'],
    ['email', 'E-mail', 'Contato'],
    ['site', 'Site', 'Contato'],
    ['segment', 'Segmento', 'Classificação'],
    ['managementType', 'Tipo da gestão', 'Gestão'],
    ['targetAudience', 'Público-alvo', 'Cadastro']
  ];
  for (const [id, label, group] of fields) {
    const value = firstDisplayValueAfterLabel(plain, label, { window: 320 });
    if (!value) continue;
    if (!profile[id]) profile[id] = value;
    addDeepFact(rows, seen, id, label, value, group, 'StatusInvestHTML.perfilFii');
  }
  return { profile, rows };
}


function escapeChecklistRegex(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checklistStatusFromHtmlText(value = '') {
  const raw = normalizeLooseText(value);
  if (!raw) return undefined;
  if (/nao\s+atende|não\s+atende|reprov|false|unchecked|uncheck|xmark|fa\s+times|icon\s+times|pendente|invalido|inválido/.test(raw)) return 'Não atende';
  if (/\batende\b|aprov|true|checked|checkmark|fa\s+check|icon\s+check|check\s+square|check\s+circle|ok|sucesso|success|positivo|satisfatorio|satisfatório|✓|✔/.test(raw)) return 'Atende';
  return undefined;
}

function checklistStatusFromHtmlNearLabel(html = '', label = '') {
  const normalizedWords = normalizeLooseText(label).split(/\s+/).filter(word => word.length >= 3).slice(0, 5);
  if (normalizedWords.length < 2) return undefined;
  const source = String(html || '')
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ');
  const sourceSearch = source.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pattern = normalizedWords.map(escapeChecklistRegex).join('[\\s\\S]{0,45}?');
  const match = new RegExp(pattern, 'i').exec(sourceSearch);
  if (!match) return undefined;
  const rawIndex = match.index;
  const openTags = ['<li', '<div', '<tr', '<label'];
  const closeTags = ['</li>', '</div>', '</tr>', '</label>'];
  const contextStart = Math.max(...openTags.map(tag => source.toLowerCase().lastIndexOf(tag, rawIndex)), -1);
  const closingCandidates = closeTags
    .map(tag => source.toLowerCase().indexOf(tag, rawIndex))
    .filter(index => index >= 0)
    .map(index => index + 8);
  const contextEnd = closingCandidates.length ? Math.min(...closingCandidates) : -1;
  const window = source.slice(
    contextStart >= 0 ? contextStart : Math.max(0, rawIndex - 180),
    contextEnd >= 0 ? Math.min(source.length, contextEnd) : Math.min(source.length, rawIndex + 520)
  );
  const negativeMatch = window.match(/(?:unchecked|not-checked|nao-atende|não-atende|reprovado|false|fa-times|icon-times|xmark|times-circle)[^<]{0,120}/i)?.[0];
  const negative = checklistStatusFromHtmlText(negativeMatch || '');
  if (negative === 'Não atende') return negative;
  const positiveMatch = window.match(/(?:checked|is-checked|aprovado|true|fa-check|icon-check|checkmark|check-square|check-circle|\u2713|✓|✔)[^<]{0,140}/i)?.[0];
  const positive = checklistStatusFromHtmlText(positiveMatch || '');
  if (positive === 'Atende') return positive;
  const plainBefore = htmlToPlainText(window.slice(0, Math.min(window.length, 1000))).slice(-120);
  return checklistStatusFromHtmlText(plainBefore);
}

const INVESTIDOR10_CHECKLIST_KNOWN_LABELS = [
  'Empresa com mais de 5 anos de Bolsa',
  'Empresa nunca deu prejuízo (ano fiscal)',
  'Empresa com lucro nos últimos 20 trimestres (5 anos)',
  'Empresa pagou +5% de dividendos/ano nos últimos 5 anos',
  'Empresa possui ROE acima de 10%',
  'Empresa possui dívida menor que patrimônio',
  'Empresa apresentou crescimento de receita nos últimos 5 anos',
  'Empresa apresentou crescimento de lucros nos últimos 5 anos',
  'Empresa possui liquidez diária acima de US$ 2M',
  'Empresa é bem avaliada pelos usuários do Investidor10',
  'FII com mais de 5 anos listado em Bolsa',
  'Dividend Yield médio dos últimos 24 meses acima de 9%',
  'Liquidez média diária acima de R$ 1 milhão',
  'Número de cotistas acima de 20 mil',
  'Patrimônio líquido acima de R$ 500 milhões',
  '5 ou mais imóveis no portfólio',
  'Vacância física média dos últimos 12 meses abaixo de 10%',
  'Vacância financeira média dos últimos 12 meses abaixo de 10%'
];

function extractInvestidor10ChecklistFromHtml(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const section = slicePlainSection(
    plain,
    ['Checklist do investidor buy and hold', 'Checklist do investidor', 'checklist buy and hold'],
    ['Histórico de Dividendos', 'Lista de Imóveis', 'Informações Adicionais', 'COMPARAÇÃO', 'ÍNDICES COM', 'Radar de Dividendos'],
    3600
  );
  if (!section) return [];
  const rows = [];
  const seen = new Set();

  for (const label of INVESTIDOR10_CHECKLIST_KNOWN_LABELS) {
    const normalizedSection = normalizeLooseText(section);
    const normalizedLabel = normalizeLooseText(label);
    const hasAllWords = normalizedLabel.split(/\s+/).filter(word => word.length >= 4).slice(0, 7).every(word => normalizedSection.includes(word));
    if (!hasAllWords) continue;
    const status = checklistStatusFromHtmlNearLabel(html, label) || 'Não informado';
    addDeepFact(rows, seen, `checklist_known_${rows.length + 1}`, label, status, 'Checklist buy and hold', 'Investidor10HTML.checklist');
  }

  const withoutIntro = section
    .replace(/Checklist do investidor buy and hold(?: sobre)?\s*[A-Z0-9]{4,8}/i, ' ')
    .replace(/Esta ferramenta[\s\S]*$/i, ' ')
    .replace(/VER RANKING[\s\S]*$/i, ' ');
  const candidates = withoutIntro
    .split(/(?=Empresa\s|FII\s|Dividend Yield\s|Liquidez\s|Número de cotistas\s|Patrimônio líquido\s|Vacância\s|Vacancia\s|5 ou mais\s)/i)
    .map(cleanDeepDisplay)
    .filter(Boolean);
  for (const item of candidates) {
    const safeTicker = String(ticker || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cleaned = item
      .replace(/^Checklist do investidor\s*/i, '')
      .replace(safeTicker ? new RegExp(safeTicker, 'i') : /$a/, '')
      .trim();
    if (cleaned.length < 12 || cleaned.length > 160) continue;
    if (/ranking|fins informativos|pontua|radar de dividendos/i.test(cleaned)) continue;
    const status = checklistStatusFromHtmlNearLabel(html, cleaned) || 'Não informado';
    addDeepFact(rows, seen, `checklist_${rows.length + 1}`, cleaned, status, 'Checklist buy and hold', 'Investidor10HTML.checklist');
  }
  return rows.slice(0, 18);
}

function extractInvestidor10FiiNarrativeFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const rows = [];
  const seen = new Set();
  const info = {};
  const additional = slicePlainSection(plain, ['Informações Adicionais'], ['Lista de Imóveis', 'TERMOS DO MERCADO', 'Histórico'], 2200);
  if (additional) {
    const cnpj = additional.match(/CNPJ\s+([\d./-]{14,20})/i)?.[1];
    const quotas = additional.match(/total de\s+([\d.]+)\s+cotas/i)?.[1];
    const cotistas = additional.match(/entre\s+([\d.]+)\s+cotistas/i)?.[1];
    const states = additional.match(/localizados principalmente em:\s*([^\.]+)\./i)?.[1];
    const adminFee = additional.match(/cobra\s+([^\.]{1,80}?taxa de administra[çc][ãa]o[^\.]*?)\s+e possui/i)?.[1];
    if (cnpj) { info.cnpj = cnpj; addDeepFact(rows, seen, 'fii_cnpj', 'CNPJ', cnpj, 'Cadastro', 'Investidor10HTML.informacoesAdicionais'); }
    if (quotas) { info.cotasEmitidas = quotas; addDeepFact(rows, seen, 'fii_quotas', 'Cotas emitidas', quotas, 'Base patrimonial', 'Investidor10HTML.informacoesAdicionais'); }
    if (cotistas) { info.numeroCotistas = cotistas; addDeepFact(rows, seen, 'fii_cotistas', 'Cotistas', cotistas, 'Base patrimonial', 'Investidor10HTML.informacoesAdicionais'); }
    if (states) { info.estadosPrincipais = states; addDeepFact(rows, seen, 'fii_states', 'Estados principais', states, 'Portfólio', 'Investidor10HTML.informacoesAdicionais'); }
    if (adminFee) { info.adminFee = adminFee; addDeepFact(rows, seen, 'fii_admin_fee', 'Taxa de administração', adminFee, 'Custos', 'Investidor10HTML.informacoesAdicionais'); }
  }
  return { info, rows };
}

function extractSourceExtractionTechnologiesFromHtml(html = '', url = '') {
  const source = String(html || '');
  const flags = [];
  if (/<table[\s>]/i.test(source)) flags.push('html_tables');
  if (/__NEXT_DATA__/i.test(source)) flags.push('next_data_json');
  if (/window\.__NUXT__|__NUXT_DATA__/i.test(source)) flags.push('nuxt_payload');
  if (/application\/ld\+json/i.test(source)) flags.push('json_ld');
  if (/application\/json|type=["']application\/json/i.test(source)) flags.push('embedded_application_json');
  if (/data-(?:chart|props|value|ticker|symbol|asset|percent|price)=/i.test(source)) flags.push('data_attributes');
  if (/JSON\.parse\(\s*`|JSON\.parse\(\s*&quot;|JSON\.parse\(\s*['"]/i.test(source)) flags.push('safe_json_parse_literals');
  if (/Highcharts|ApexCharts|Chart\(|new\s+Chart|echarts|series\s*:/i.test(source)) flags.push('chart_library_state');
  if (/company[A-Za-z0-9_]*(?:Chart|Charts|Data)|fund[A-Za-z0-9_]*(?:Chart|Charts|Data)|hist[oó]rico/i.test(source)) flags.push('inline_chart_state');
  if (/\/api\/(?:acoes|fii|balancos|cotacao|comparador|indicadores)|chart\/|historico-indicadores/i.test(source)) flags.push('discovered_internal_api_routes');
  if (/<script[\s\S]+?src=/i.test(source)) flags.push('linked_script_scan');
  if (/statusinvest\.com\.br/i.test(url)) flags.push('statusinvest_html');
  if (/investidor10\.com\.br/i.test(url)) flags.push('investidor10_html');
  return [...new Set(flags)].map(flag => ({ id: flag, label: flag, value: 'suportado', source: 'VALORAE extractor capability' }));
}

function sourceDriftProviderFromUrl(url = '') {
  if (/statusinvest\.com\.br\/acoes/i.test(url)) return 'statusinvest_acoes';
  if (/statusinvest\.com\.br\/fundos-imobiliarios/i.test(url)) return 'statusinvest_fii';
  if (/investidor10\.com\.br\/acoes/i.test(url)) return 'investidor10_acoes';
  if (/investidor10\.com\.br\/fiis/i.test(url)) return 'investidor10_fii';
  return /statusinvest/i.test(url) ? 'statusinvest' : (/investidor10/i.test(url) ? 'investidor10' : 'unknown');
}

function sourceDriftExpectedKeys(url = '') {
  const provider = sourceDriftProviderFromUrl(url);
  if (provider === 'statusinvest_acoes') return ['summary', 'indicators', 'marketContext', 'dividends', 'events'];
  if (provider === 'investidor10_acoes') return ['indicatorHistory', 'valuationModels', 'sourceComparatives', 'checklist', 'charts'];
  if (provider === 'statusinvest_fii') return ['summary', 'fiiIndicators', 'fiiAccounting', 'fiiPortfolio', 'fiiDividends'];
  if (provider === 'investidor10_fii') return ['indicatorHistory', 'fiiInfo', 'fiiPortfolio', 'fiiComparatives', 'checklist'];
  return ['summary', 'indicators'];
}

function buildSourceDriftResults(url = '', deep = {}) {
  const provider = sourceDriftProviderFromUrl(url);
  const facts = Array.isArray(deep.sourceFacts) ? deep.sourceFacts : [];
  const tech = Array.isArray(deep.sourceExtractionTechnologies) ? deep.sourceExtractionTechnologies : [];
  const base = {
    summary: facts.length || Object.keys(deep.profile || {}).length || tech.length,
    indicators: Object.keys(deep.indicators || {}).length || facts.some(row => /indicador|liquidez|tag along|volatilidade|dy|p\/vp/i.test(`${row.label} ${row.group}`)),
    marketContext: facts.some(row => /faixa de preço|desempenho|risco|liquidez|mercado|aluguel/i.test(row.group || '')),
    dividends: facts.some(row => /dividend|provento|rendimento/i.test(`${row.label} ${row.group}`)),
    events: (deep.corporateEvents || []).length || facts.some(row => /evento|subscrição|split|grupamento/i.test(`${row.label} ${row.group}`)),
    indicatorHistory: /hist[oó]rico|indicadores fundamentalistas/i.test(String(deep._plainProbe || '')),
    valuationModels: facts.some(row => /graham|bazin|preço justo|preco justo/i.test(`${row.label} ${row.group}`)),
    sourceComparatives: facts.some(row => /comparativo|setor|subsetor|segmento|ranking/i.test(`${row.label} ${row.group}`)),
    checklist: (deep.checklistBuyHold || []).length,
    charts: tech.some(row => /chart|next_data|inline/i.test(row.id || row.label || '')),
    fiiIndicators: facts.some(row => /fii|p\/vp|vacância|cotistas|cotas|patrimonial/i.test(`${row.label} ${row.group}`)),
    fiiAccounting: facts.some(row => /contábil|patrimônio|ativos|disponibilidades|títulos|cri|lci|lig|valores/i.test(`${row.label} ${row.group}`)),
    fiiPortfolio: facts.some(row => /portfólio|imóveis|imoveis|estado|vacância|abl/i.test(`${row.label} ${row.group}`)),
    fiiDividends: facts.some(row => /rendimento|provisionado|ano atual|ano passado/i.test(`${row.label} ${row.group}`)),
    fiiInfo: Object.keys(deep.fiiInfo || {}).length || facts.some(row => /razão social|cnpj|mandato|gestão|segmento|taxa/i.test(row.label || '')),
    fiiComparatives: facts.some(row => /ifix|comparação|comparacao|índice|indice/i.test(`${row.label} ${row.group}`)),
  };
  if (provider.includes('investidor10')) base.indicatorHistory = base.indicatorHistory || /hist[oó]rico de indicadores fundamentalistas/i.test(String(deep._htmlProbe || ''));
  return base;
}

function buildSourceDriftReport(html = '', url = '', deep = {}) {
  const requiredKeys = sourceDriftExpectedKeys(url);
  const results = buildSourceDriftResults(url, { ...deep, _htmlProbe: html.slice(0, 20000), _plainProbe: htmlToPlainText(html).slice(0, 20000) });
  const selectors = Object.fromEntries(requiredKeys.map(key => [key, true]));
  return inspectSourceDrift({
    provider: sourceDriftProviderFromUrl(url),
    url,
    html,
    results,
    selectors,
    requiredKeys,
    minCoverage: 0.4
  });
}

function extractPageDeepCoverageFromHtml(html = '', url = '', ticker = '') {
  const sourceFacts = [];
  const seen = new Set();
  const stockDeep = /statusinvest\.com\.br\/acoes/i.test(url) ? extractStatusInvestStockDeepFieldsFromHtml(html) : { rows: [], profile: {}, indicators: {} };
  const stockLending = /statusinvest\.com\.br\/acoes/i.test(url) ? extractStatusInvestStockLendingFromHtml(html) : [];
  const corporateEvents = /statusinvest\.com\.br/i.test(url) ? [
    ...extractStatusInvestCorporateEventsFromHtml(html),
    ...extractStatusInvestCalendarEventsFromHtml(html)
  ] : [];
  const fiiProfile = /statusinvest\.com\.br\/fundos-imobiliarios/i.test(url) ? extractStatusInvestFiiProfileDeepFromHtml(html) : { rows: [], profile: {} };
  const fiiDividendSnapshot = /statusinvest\.com\.br\/fundos-imobiliarios/i.test(url) ? extractStatusInvestFiiDividendSnapshotFromHtml(html) : [];
  const i10Checklist = /investidor10\.com\.br/i.test(url) ? extractInvestidor10ChecklistFromHtml(html, ticker) : [];
  const i10FiiNarrative = /investidor10\.com\.br\/fiis/i.test(url) ? extractInvestidor10FiiNarrativeFromHtml(html) : { rows: [], info: {} };
  const i10FiiInfoFacts = /investidor10\.com\.br\/fiis/i.test(url) ? extractInvestidor10FiiInfoFactsFromHtml(html) : { rows: [], info: {} };
  for (const row of [...stockDeep.rows, ...stockLending, ...fiiProfile.rows, ...fiiDividendSnapshot, ...i10FiiNarrative.rows, ...i10FiiInfoFacts.rows]) {
    addDeepFact(sourceFacts, seen, row.id, row.label, row.value, row.group, row.source);
  }
  const sourceExtractionTechnologies = extractSourceExtractionTechnologiesFromHtml(html, url);
  const deep = {
    sourceFacts,
    profile: { ...stockDeep.profile, ...fiiProfile.profile },
    indicators: { ...stockDeep.indicators },
    corporateEvents,
    checklistBuyHold: i10Checklist,
    fiiInfo: { ...i10FiiInfoFacts.info, ...i10FiiNarrative.info },
    sourceExtractionTechnologies
  };
  return {
    ...deep,
    sourceDriftReports: [buildSourceDriftReport(html, url, deep)]
  };
}



function decodeInvestidor10Inline(value = '') {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/');
}

function normalizeJsLikeInlineJson(raw = '') {
  let s = decodeInvestidor10Inline(String(raw || '').trim());
  if (!s) return '';
  if (s.endsWith(';')) s = s.slice(0, -1).trim();
  s = s
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1');
  // O HTML do Investidor10 às vezes contém objetos JS-like. Aceitamos somente
  // normalização textual segura para JSON; nunca executamos eval/new Function.
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(String(inner).replace(/\\'/g, "'")));
  return s;
}

function safeParseInlineJson(value = '') {
  const raw = String(value || '').trim();
  const candidates = [raw, decodeInvestidor10Inline(raw), normalizeJsLikeInlineJson(raw)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

function extractBalancedJsonLiteral(source = '', startIndex = 0) {
  const open = source[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, i + 1);
    }
  }
  return '';
}

function extractInvestidor10InlineJson(html = '', patterns = []) {
  const source = String(html || '');
  for (const re of patterns) {
    const match = source.match(re);
    if (!match?.[1]) continue;
    let raw = match[1];
    if (raw[0] === '{' || raw[0] === '[') {
      const captureOffset = match[0].indexOf(raw);
      const start = match.index + (captureOffset >= 0 ? captureOffset : match[0].lastIndexOf(raw[0]));
      const balanced = extractBalancedJsonLiteral(source, start);
      if (balanced) raw = balanced;
    }
    const parsed = safeParseInlineJson(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

function escapeInlineRe(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractInvestidor10BacktickJson(html = '', varName = '') {
  const source = String(html || '');
  const escaped = escapeInlineRe(varName);
  const patterns = [
    new RegExp(`${escaped}\\s*=\\s*JSON\\.parse\\(\\s*\`([\\s\\S]*?)\`\\s*\\)`, 'i'),
    new RegExp(`${escaped}\\s*=\\s*\`([\\s\\S]*?)\`\\s*;`, 'i')
  ];
  for (const re of patterns) {
    const m = source.match(re);
    if (!m?.[1]) continue;
    const parsed = safeParseInlineJson(m[1]);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

function extractInvestidor10RentabilidadeChart(html = '') {
  const direct = extractInvestidor10InlineJson(html, [
    /rentabilidadeChart\s*=\s*(\{[\s\S]*?\})\s*;/i,
    /profitabilityChart\s*=\s*(\{[\s\S]*?\})\s*;/i
  ]);
  if (direct) return direct;
  const last = extractInvestidor10BacktickJson(html, 'lastProfitability');
  const profitabilities = extractInvestidor10BacktickJson(html, 'profitabilities');
  const legend = extractInvestidor10BacktickJson(html, 'legend');
  return last || profitabilities || legend ? { lastProfitability: last, profitabilities, legend } : null;
}

function extractInvestidor10EmbeddedAnalysisData(html = '') {
  return {
    advancedMetrics: extractInvestidor10InlineJson(html, [/_sectorIndicators\s*=\s*(\{[\s\S]*?\})\s*;/i, /sectorIndicators\s*=\s*(\{[\s\S]*?\})\s*;/i]),
    revenueGeography: extractInvestidor10InlineJson(html, [/companyRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i]),
    revenueSegment: extractInvestidor10InlineJson(html, [/companyBussinesRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i, /companyBusinessRevenuesChartPie\s*=\s*(\{[\s\S]*?\})\s*;/i]),
    rentabilidadeChart: extractInvestidor10RentabilidadeChart(html)
  };
}

async function fetchInvestidor10AnalysisExtras(ticker, type, html = '', options = {}) {
  const clean = normalizeTicker(ticker);
  const ids = extractInvestidor10ChartIds(html);
  const embedded = extractInvestidor10EmbeddedAnalysisData(html);
  const base = 'https://investidor10.com.br';
  const timeoutMs = Number(options.internalApiTimeoutMs || options.timeoutMs || 8200);
  const rawJson = {};
  const apiStatus = [];
  const tasks = [];
  const existingUrls = new Set();
  const addTask = (key, url) => {
    const u = String(url || '').trim();
    if (!u || existingUrls.has(u)) return;
    existingUrls.add(u);
    tasks.push([key, u]);
  };
  if (type !== 'fii' && ids.companyId) {
    addTask('receitasLucros', `${base}/api/balancos/receitaliquida/chart/${ids.companyId}/3650/false/`);
    addTask('evolucaoPatrimonio', `${base}/api/balancos/ativospassivos/chart/${ids.companyId}/3650/`);
    addTask('resultadoDre', `${base}/api/balancos/resultado/chart/${ids.companyId}/3650/`);
    addTask('fluxoCaixa', `${base}/api/balancos/fluxocaixa/chart/${ids.companyId}/3650/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/`);
    if (clean) addTask('lucroCotacao', `${base}/api/cotacao-lucro/${clean.toLowerCase()}/adjusted/`);
    if (ids.tickerId && clean) addTask('payoutHistorico', `${base}/api/acoes/payout-chart/${ids.companyId}/${ids.tickerId}/${clean.toUpperCase()}/3650`);
  }
  if (type === 'fii' && ids.fiiId) {
    addTask('historicoIndicadoresFii', `${base}/api/fii/historico-indicadores/${ids.fiiId}/10`);
    addTask('comparadorFiis', `${base}/api/fii/comparador/table/${ids.fiiId}/`);
    addTask('dividendYieldFii', `${base}/api/fii/dividend-yield-chart/${ids.fiiId}/10`);
    addTask('distribuicaoAtivosFii', `${base}/api/fii/distribuicao-ativos/${ids.fiiId}/`);
    addTask('listaImoveisFii', `${base}/api/fii/lista-imoveis/${ids.fiiId}/`);
  }
  const discoveredUrls = discoverInvestidor10ChartApiUrls(html, clean, type === 'fii' ? 'FII' : 'ACAO');
  for (const url of discoveredUrls) {
    if (tasks.length >= 28) break;
    const suffix = String(url).split('/api/')[1] || 'chart';
    const key = `i10Api_${suffix.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70)}`;
    addTask(key, url);
  }
  const refererType = ({ fii: 'fiis', etf: 'etfs', bdr: 'bdrs', acao: 'acoes' })[String(type || '').toLowerCase()] || 'acoes';
  const responses = await Promise.all(tasks.map(async ([key, url]) => {
    const result = await fetchJson(url, {
      timeoutMs,
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 1,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': `${base}/${refererType}/${String(clean || '').toLowerCase()}/`
      }
    });
    return [key, url, result];
  }));
  for (const [key, url, result] of responses) {
    apiStatus.push({ key, url, status: result.status, ok: Boolean(result.json), cacheStatus: result.cacheStatus, error: result.error || (result.parseError ? 'parse-error' : undefined) });
    if (result.json) rawJson[key] = result.json;
  }
  const apiExtras = { embedded, rawJson, chartsFinanceiros: rawJson, apiStatus, historicoIndicadoresFii: rawJson.historicoIndicadoresFii };
  const canonical = buildInvestidor10CanonicalCharts({ ticker: clean, type: canonicalInvestidor10Type(type), html, apiExtras });
  return { apiExtras, canonical };
}

async function fetchFundamentalSnapshot(ticker, options = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY' };
  const legacyType = statusInvestType(clean);
  const urls = [
    ...statusInvestPageTypes(clean).map(type => `https://statusinvest.com.br/${type}/${clean.toLowerCase()}`),
    ...investidor10PageTypes(clean).map(type => `https://investidor10.com.br/${type}/${clean.toLowerCase()}/`)
  ];
  let best = { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [] };
  for (const url of urls) {
    const { text, status, cacheStatus, error } = await fetchText(url, {
      timeoutMs: Number(options.timeoutMs || 4200),
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000
    });
    const parsed = parseMetricsFromHtml(text);
    if (text) {
      const deepCoverage = extractPageDeepCoverageFromHtml(text, url, clean);
      if (deepCoverage.sourceFacts?.length) parsed.sourceFacts = [...(parsed.sourceFacts || []), ...deepCoverage.sourceFacts];
      if (deepCoverage.corporateEvents?.length) parsed.corporateEvents = [...(parsed.corporateEvents || []), ...deepCoverage.corporateEvents];
      if (deepCoverage.checklistBuyHold?.length) parsed.checklistBuyHold = [...(parsed.checklistBuyHold || []), ...deepCoverage.checklistBuyHold];
      if (deepCoverage.sourceExtractionTechnologies?.length) parsed.sourceExtractionTechnologies = [...(parsed.sourceExtractionTechnologies || []), ...deepCoverage.sourceExtractionTechnologies];
      if (deepCoverage.profile && Object.keys(deepCoverage.profile).length) parsed.profile = { ...(parsed.profile || {}), ...deepCoverage.profile };
      if (deepCoverage.indicators && Object.keys(deepCoverage.indicators).length) parsed.indicators = { ...(parsed.indicators || {}), ...deepCoverage.indicators };
      if (deepCoverage.fiiInfo && Object.keys(deepCoverage.fiiInfo).length) parsed.fiiInfo = { ...(parsed.fiiInfo || {}), ...deepCoverage.fiiInfo };
      if (deepCoverage.sourceDriftReports?.length) parsed.sourceDriftReports = [...(parsed.sourceDriftReports || []), ...deepCoverage.sourceDriftReports];
    }
    if (url.includes('statusinvest.com.br/fundos-imobiliarios') && text) {
      const statusInvestFiiPortfolio = extractStatusInvestFiiPortfolioFromHtml(text);
      if (statusInvestFiiPortfolio.length) parsed.statusInvestFiiPortfolio = statusInvestFiiPortfolio;
      const statusInvestFiiAccounting = extractStatusInvestFiiAccountingFromHtml(text);
      if (Object.keys(statusInvestFiiAccounting).length) parsed.statusInvestFiiAccounting = statusInvestFiiAccounting;
      const statusInvestFiiHighlights = extractStatusInvestFiiHighlightsFromHtml(text);
      if (Object.keys(statusInvestFiiHighlights).length) parsed.fiiInfo = { ...(parsed.fiiInfo || {}), ...statusInvestFiiHighlights };
      const statusInvestIndices = extractStatusInvestIndicesFromHtml(text);
      if (statusInvestIndices.length) {
        parsed.statusInvestIndices = statusInvestIndices;
        parsed.indices = statusInvestIndices;
      }
    }
    if (url.includes('statusinvest.com.br/acoes') && text) {
      const statusInvestIndices = extractStatusInvestIndicesFromHtml(text);
      if (statusInvestIndices.length) {
        parsed.statusInvestIndices = statusInvestIndices;
        parsed.indices = statusInvestIndices;
      }
    }
    if (url.includes('investidor10.com.br') && text) {
      try {
        const investidor10Type = investidor10ExtractorTypeFromPath(url);
        const extras = await fetchInvestidor10AnalysisExtras(clean, investidor10Type, text, options);
        parsed.assetChartsCanonical = extras.canonical;
        parsed.financialChartsCanonical = extras.canonical?.financial || {};
        parsed.revenueGeography = extras.canonical?.revenueGeography || extras.canonical?.revenueByRegion || extras.apiExtras?.embedded?.revenueGeography || null;
        parsed.revenueSegment = extras.canonical?.revenueSegment || extras.canonical?.revenueByBusiness || extras.apiExtras?.embedded?.revenueSegment || null;
        parsed.revenueByRegion = parsed.revenueGeography;
        parsed.revenueByBusiness = parsed.revenueSegment;
        parsed.chartsFinanceiros = extras.apiExtras?.chartsFinanceiros || {};
        parsed.historicoIndicadores = extras.canonical?.company?.fundamentalIndicatorHistory || extras.canonical?.fii?.fundamentalIndicatorHistory || extras.canonical?.fundamentalIndicatorHistory || null;
        const valuationModels = extractInvestidor10ValuationModelsFromHtml(text);
        if (Object.keys(valuationModels).length) parsed.valuationModels = valuationModels;
        const sourceComparatives = (parsed.indicatorCards || []).filter(card => card?.comparisons && Object.keys(card.comparisons).length);
        if (sourceComparatives.length) parsed.sourceComparatives = sourceComparatives;
        const i10Indices = extractStatusInvestIndicesFromHtml(text);
        if (i10Indices.length) {
          parsed.investidor10Indices = i10Indices;
          parsed.indices = parsed.indices || i10Indices;
        }
        if (extras.canonical?.fii) {
          parsed.fiiInfo = { ...(parsed.fiiInfo || {}), ...(extras.canonical.fii.info || {}) };
          parsed.listaImoveis = extras.canonical.fii.physicalAssets || [];
          parsed.physicalAssets = extras.canonical.fii.physicalAssets || [];
          parsed.distribuicaoAtivosFundo = extras.canonical.fii.assetDistribution || [];
          parsed.assetDistribution = extras.canonical.fii.assetDistribution || [];
          parsed.fiiPeerComparison = extras.canonical.fii.peerComparison || [];
          parsed.comparadorFiis = extras.canonical.fii.peerComparison || [];
          parsed.distribuicoes12m = extras.canonical.fii.distribution12m || [];
          parsed.dividendYieldHistory = extras.canonical.fii.dividendYieldHistory || [];
        }
        parsed.apiExtras = extras.apiExtras;
        const ownership = extractInvestidor10OwnershipFromHtml(text);
        if (ownership) {
          parsed.ownership = ownership;
          parsed.shareholders = ownership.rows;
          parsed.posicaoAcionaria = ownership;
        }
        parsed.diagnostics = [
          ...(parsed.diagnostics || []),
          { provider: 'investidor10-analysis-extras', status: 'OK', sourceType: investidor10Type, apiCalls: extras.apiExtras?.apiStatus?.length || 0, revenueRegion: Boolean(parsed.revenueGeography), revenueBusiness: Boolean(parsed.revenueSegment), financial: Boolean(parsed.financialChartsCanonical && Object.keys(parsed.financialChartsCanonical).length), ownership: Boolean(parsed.ownership?.rows?.length) }
        ];
      } catch (error) {
        parsed.diagnostics = [...(parsed.diagnostics || []), { provider: 'investidor10-analysis-extras', status: 'ERROR', error: error?.message || String(error) }];
      }
    }
    const provider = url.includes('statusinvest') ? statusInvestProviderFromUrl(url) : investidor10ProviderFromUrl(url);
    best.diagnostics.push({ provider, legacyType, status, cacheStatus, count: parsed.indicatorCards.length, error }, ...(parsed.diagnostics || []));
    const parsedStrength = parsed.indicatorCards.length + (parsed.assetChartsCanonical ? 8 : 0) + (parsed.revenueGeography ? 3 : 0) + (parsed.revenueSegment ? 3 : 0) + (parsed.fiiInfo ? 2 : 0) + (parsed.valuationModels ? 2 : 0) + (Array.isArray(parsed.sourceComparatives) ? Math.min(parsed.sourceComparatives.length, 4) : 0) + (parsed.statusInvestFiiAccounting ? 3 : 0) + (Array.isArray(parsed.indices) ? Math.min(parsed.indices.length, 3) : 0) + (Array.isArray(parsed.listaImoveis) ? Math.min(parsed.listaImoveis.length, 6) : 0) + (Array.isArray(parsed.statusInvestFiiPortfolio) ? Math.min(parsed.statusInvestFiiPortfolio.length, 6) : 0) + (Array.isArray(parsed.sourceFacts) ? Math.min(parsed.sourceFacts.length, 4) : 0) + (Array.isArray(parsed.corporateEvents) ? Math.min(parsed.corporateEvents.length, 4) : 0) + (Array.isArray(parsed.checklistBuyHold) ? Math.min(parsed.checklistBuyHold.length, 4) : 0);
    const bestStrength = best.indicatorCards.length + (best.assetChartsCanonical ? 8 : 0) + (best.revenueGeography ? 3 : 0) + (best.revenueSegment ? 3 : 0) + (best.fiiInfo ? 2 : 0) + (best.valuationModels ? 2 : 0) + (Array.isArray(best.sourceComparatives) ? Math.min(best.sourceComparatives.length, 4) : 0) + (best.statusInvestFiiAccounting ? 3 : 0) + (Array.isArray(best.indices) ? Math.min(best.indices.length, 3) : 0) + (Array.isArray(best.listaImoveis) ? Math.min(best.listaImoveis.length, 6) : 0) + (Array.isArray(best.statusInvestFiiPortfolio) ? Math.min(best.statusInvestFiiPortfolio.length, 6) : 0) + (Array.isArray(best.sourceFacts) ? Math.min(best.sourceFacts.length, 4) : 0) + (Array.isArray(best.corporateEvents) ? Math.min(best.corporateEvents.length, 4) : 0) + (Array.isArray(best.checklistBuyHold) ? Math.min(best.checklistBuyHold.length, 4) : 0);
    if (parsedStrength > bestStrength) best = { ...best, ...parsed, status: parsed.indicatorCards.length || parsed.assetChartsCanonical || parsed.sourceFacts?.length || parsed.corporateEvents?.length || parsed.checklistBuyHold?.length ? 'OK' : 'EMPTY', sourceUrl: url, diagnostics: best.diagnostics };
  }
  return best;
}



function rawMetric(obj, path, fallback = 0) {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) cur = cur?.[part];
  if (cur && typeof cur === 'object' && 'raw' in cur) return numberValue(cur.raw, fallback);
  if (cur && typeof cur === 'object' && 'fmt' in cur) return numberValue(cur.fmt, fallback);
  return numberValue(cur, fallback);
}

function textMetric(obj, path, fallback = '') {
  const parts = String(path || '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) cur = cur?.[part];
  if (cur && typeof cur === 'object' && 'fmt' in cur) return String(cur.fmt || fallback);
  if (cur && typeof cur === 'object' && 'longFmt' in cur) return String(cur.longFmt || fallback);
  if (cur === undefined || cur === null) return fallback;
  return String(cur || fallback);
}

function percentMetric(value) {
  const n = numberValue(value, 0);
  if (!Number.isFinite(n) || n === 0) return 0;
  return Math.abs(n) <= 1.5 ? round(n * 100, 2) : round(n, 2);
}

const AGGREGATE_INDICATOR_KEYS = new Set(['valorDeMercado', 'valorDeFirma', 'liquidezMediaDiaria', 'ebitda', 'receitaTotal', 'lucroBruto', 'dividaBruta', 'dividaLiquida', 'disponibilidade', 'patrimonioLiquido']);

function brlIndicatorDisplay(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
  if (abs >= 1e12) return `R$ ${fmt(n / 1e12)} tri`;
  if (abs >= 1e9) return `R$ ${fmt(n / 1e9)} bi`;
  if (abs >= 1e6) return `R$ ${fmt(n / 1e6)} mi`;
  if (abs >= 1e3 && AGGREGATE_INDICATOR_KEYS.has(key)) return `R$ ${fmt(n / 1e3)} mil`;
  return `R$ ${fmt(n)}`;
}

function pushIndicator(cards, indicators, key, label, value, unit = '', display) {
  const n = numberValue(value, 0);
  if (!Number.isFinite(n) || n === 0) return;
  if (unit === 'BRL' && AGGREGATE_INDICATOR_KEYS.has(key) && Math.abs(n) < 1000) return;
  if (!indicators[key]) indicators[key] = round(n, 4);
  if (!cards.some(card => card.label === label)) {
    const text = display || (unit === '%' ? `${round(n, 2).toFixed(2)}%` : unit === 'BRL' ? brlIndicatorDisplay(key, n) : String(round(n, 4)));
    cards.push({ label, value: round(n, 4), display: text, unit, source: 'VALORAE Fonte Oficial' });
  }
}

function statementYear(row) {
  const raw = rawMetric(row, 'endDate', 0);
  if (raw > 0) return String(new Date(raw * 1000).getUTCFullYear());
  return textMetric(row, 'endDate.fmt', String(new Date().getUTCFullYear())).slice(0, 4);
}

function yahooFinancialSeries(summary = {}) {
  const incomeRows = summary.incomeStatementHistory?.incomeStatementHistory || [];
  const balanceRows = summary.balanceSheetHistory?.balanceSheetStatements || [];
  const revenueProfit = incomeRows.map(row => ({
    label: statementYear(row),
    year: statementYear(row),
    netRevenue: rawMetric(row, 'totalRevenue'),
    cost: rawMetric(row, 'costOfRevenue'),
    grossProfit: rawMetric(row, 'grossProfit'),
    ebit: rawMetric(row, 'ebit'),
    ebitda: rawMetric(row, 'ebitda'),
    netProfit: rawMetric(row, 'netIncome')
  })).filter(row => row.netRevenue || row.netProfit || row.ebit || row.ebitda).reverse();
  const balance = balanceRows.map(row => ({
    label: statementYear(row),
    year: statementYear(row),
    netWorth: rawMetric(row, 'totalStockholderEquity'),
    totalAssets: rawMetric(row, 'totalAssets'),
    totalLiabilities: rawMetric(row, 'totalLiab')
  })).filter(row => row.netWorth || row.totalAssets || row.totalLiabilities).reverse();
  // Checkpoint 28 revisão: não fabricar Lucro x Cotação aqui.
  // O gráfico só deve nascer quando houver cotação real alinhada ao período,
  // não com lucro duplicado como cotação nem com série secundária zerada.
  const profitVsQuote = [];
  return { revenueProfit, balance, profitVsQuote };
}

async function fetchYahooFundamentalSnapshot(ticker, options = {}) {
  const clean = normalizeTicker(ticker);
  if (!clean) return { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [] };
  const modules = [
    'price','summaryDetail','defaultKeyStatistics','financialData','assetProfile',
    'incomeStatementHistory','balanceSheetHistory','cashflowStatementHistory','earnings','calendarEvents'
  ].join(',');
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol(clean))}?modules=${encodeURIComponent(modules)}`;
  const { json, status, cacheStatus, error } = await fetchJson(url, {
    timeoutMs: Number(options.timeoutMs || 4200),
    ttlMs: 4 * 60 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    headers: { Accept: 'application/json,*/*' }
  });
  const summary = json?.quoteSummary?.result?.[0] || {};
  const indicators = {};
  const indicatorCards = [];
  const price = summary.price || {};
  const detail = summary.summaryDetail || {};
  const stats = summary.defaultKeyStatistics || {};
  const fin = summary.financialData || {};
  const profile = summary.assetProfile || {};
  pushIndicator(indicatorCards, indicators, 'precoAtual', 'Preço Atual', rawMetric(price, 'regularMarketPrice'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'valorDeMercado', 'Valor de Mercado', rawMetric(price, 'marketCap') || rawMetric(stats, 'marketCap'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'valorDeFirma', 'Valor de Firma', rawMetric(stats, 'enterpriseValue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'liquidezMediaDiaria', 'Liquidez Média Diária', rawMetric(detail, 'averageVolume') * rawMetric(price, 'regularMarketPrice'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'dividendYield', 'Dividend Yield', percentMetric(rawMetric(detail, 'dividendYield') || rawMetric(detail, 'trailingAnnualDividendYield')), '%');
  pushIndicator(indicatorCards, indicators, 'pl', 'P/L', rawMetric(stats, 'trailingPE') || rawMetric(summary, 'summaryDetail.trailingPE'));
  pushIndicator(indicatorCards, indicators, 'forwardPE', 'Forward P/E', rawMetric(stats, 'forwardPE'));
  pushIndicator(indicatorCards, indicators, 'pvp', 'P/VP', rawMetric(stats, 'priceToBook'));
  pushIndicator(indicatorCards, indicators, 'psr', 'PSR', rawMetric(stats, 'priceToSalesTrailing12Months'));
  pushIndicator(indicatorCards, indicators, 'lpa', 'LPA', rawMetric(stats, 'trailingEps'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'vpa', 'VPA', rawMetric(stats, 'bookValue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'roe', 'ROE', percentMetric(rawMetric(fin, 'returnOnEquity')), '%');
  pushIndicator(indicatorCards, indicators, 'roa', 'ROA', percentMetric(rawMetric(fin, 'returnOnAssets')), '%');
  pushIndicator(indicatorCards, indicators, 'margemLiquida', 'Margem Líquida', percentMetric(rawMetric(fin, 'profitMargins') || rawMetric(detail, 'profitMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'margemBruta', 'Margem Bruta', percentMetric(rawMetric(fin, 'grossMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'margemEbitda', 'Margem EBITDA', percentMetric(rawMetric(fin, 'ebitdaMargins')), '%');
  pushIndicator(indicatorCards, indicators, 'ebitda', 'EBITDA', rawMetric(fin, 'ebitda'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'receitaTotal', 'Receita Total', rawMetric(fin, 'totalRevenue'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'lucroBruto', 'Lucro Bruto', rawMetric(fin, 'grossProfits'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'crescimentoReceita', 'Crescimento Receita', percentMetric(rawMetric(fin, 'revenueGrowth')), '%');
  pushIndicator(indicatorCards, indicators, 'crescimentoLucro', 'Crescimento Lucro', percentMetric(rawMetric(fin, 'earningsGrowth')), '%');
  pushIndicator(indicatorCards, indicators, 'dividaBruta', 'Dívida Bruta', rawMetric(fin, 'totalDebt'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'disponibilidade', 'Disponibilidade', rawMetric(fin, 'totalCash'), 'BRL');
  const netDebt = rawMetric(fin, 'totalDebt') - rawMetric(fin, 'totalCash');
  pushIndicator(indicatorCards, indicators, 'dividaLiquida', 'Dívida Líquida', netDebt, 'BRL');
  pushIndicator(indicatorCards, indicators, 'liquidezCorrente', 'Liquidez Corrente', rawMetric(fin, 'currentRatio'));
  pushIndicator(indicatorCards, indicators, 'dividaBrutaPatrimonio', 'Dívida Bruta/Patrimônio', rawMetric(fin, 'debtToEquity'));
  if (rawMetric(fin, 'ebitda') !== 0) pushIndicator(indicatorCards, indicators, 'dividaLiquidaEbitda', 'Dívida Líquida/EBITDA', netDebt / rawMetric(fin, 'ebitda'));
  pushIndicator(indicatorCards, indicators, 'freeFloat', 'Free Float', percentMetric(rawMetric(stats, 'floatShares') / Math.max(1, rawMetric(stats, 'sharesOutstanding'))), '%');
  pushIndicator(indicatorCards, indicators, 'cotasEmitidas', 'Cotas Emitidas', rawMetric(stats, 'sharesOutstanding'), 'number');
  pushIndicator(indicatorCards, indicators, 'max52Semanas', 'Máxima 52 Semanas', rawMetric(detail, 'fiftyTwoWeekHigh'), 'BRL');
  pushIndicator(indicatorCards, indicators, 'min52Semanas', 'Mínima 52 Semanas', rawMetric(detail, 'fiftyTwoWeekLow'), 'BRL');
  const financialSeries = yahooFinancialSeries(summary);
  const description = textMetric(profile, 'longBusinessSummary');
  const sector = textMetric(profile, 'sector');
  const industry = textMetric(profile, 'industry');
  return {
    indicators,
    indicatorCards,
    profile: {
      description,
      sector,
      industry,
      website: textMetric(profile, 'website'),
      country: textMetric(profile, 'country'),
      city: textMetric(profile, 'city'),
      employees: textMetric(profile, 'fullTimeEmployees')
    },
    financialSeries,
    financialSummary: {
      valorDeMercado: indicators.valorDeMercado || 0,
      valorDeFirma: indicators.valorDeFirma || 0,
      patrimonioLiquido: financialSeries.balance.at(-1)?.netWorth || 0,
      ativos: financialSeries.balance.at(-1)?.totalAssets || 0,
      dividaBruta: indicators.dividaBruta || 0,
      dividaLiquida: indicators.dividaLiquida || 0,
      disponibilidade: indicators.disponibilidade || 0,
      liquidezMediaDiaria: indicators.liquidezMediaDiaria || 0,
      ratiosChave: { ...indicators },
      keyRatios: { ...indicators }
    },
    status: indicatorCards.length ? 'OK' : 'EMPTY',
    diagnostics: [{ provider: 'yahoo-summary', status, cacheStatus, count: indicatorCards.length, error }]
  };
}

function mergeFundamentalSnapshots(...snapshots) {
  const merged = { indicators: {}, indicatorCards: [], profile: {}, status: 'EMPTY', diagnostics: [], financialSeries: {}, financialSummary: {}, assetChartsCanonical: null, financialChartsCanonical: null, revenueGeography: null, revenueSegment: null, revenueByRegion: null, revenueByBusiness: null, chartsFinanceiros: {}, ownership: null, historicoIndicadores: null, valuationModels: null, sourceComparatives: null, relatedCompanies: null, peerFundamentalComparator: null, comparativeGroups: null, sourceFacts: [], corporateEvents: [], checklistBuyHold: [], sourceExtractionTechnologies: [], sourceDriftReports: [], fiiInfo: null, listaImoveis: null, physicalAssets: null, distribuicaoAtivosFundo: null, assetDistribution: null, fiiPeerComparison: null, comparadorFiis: null, distribuicoes12m: null, statusInvestFiiPortfolio: null, statusInvestFiiAccounting: null, statusInvestIndices: null, indices: null, dividendYieldHistory: null };
  for (const snap of snapshots.filter(Boolean)) {
    Object.assign(merged.indicators, snap.indicators || {});
    Object.assign(merged.profile, snap.profile || {});
    Object.assign(merged.financialSummary, snap.financialSummary || {});
    if (snap.financialSeries) merged.financialSeries = { ...(merged.financialSeries || {}), ...snap.financialSeries };
    if (snap.assetChartsCanonical) merged.assetChartsCanonical = snap.assetChartsCanonical;
    if (snap.financialChartsCanonical) merged.financialChartsCanonical = snap.financialChartsCanonical;
    if (snap.revenueGeography && !merged.revenueGeography) { merged.revenueGeography = snap.revenueGeography; merged.revenueByRegion = snap.revenueGeography; }
    if (snap.revenueSegment && !merged.revenueSegment) { merged.revenueSegment = snap.revenueSegment; merged.revenueByBusiness = snap.revenueSegment; }
    if (snap.revenueByRegion && !merged.revenueByRegion) merged.revenueByRegion = snap.revenueByRegion;
    if (snap.revenueByBusiness && !merged.revenueByBusiness) merged.revenueByBusiness = snap.revenueByBusiness;
    if (snap.chartsFinanceiros) merged.chartsFinanceiros = { ...(merged.chartsFinanceiros || {}), ...snap.chartsFinanceiros };
    if (snap.ownership && !merged.ownership) merged.ownership = snap.ownership;
    if (snap.posicaoAcionaria && !merged.ownership) merged.ownership = snap.posicaoAcionaria;
    if (snap.historicoIndicadores && !merged.historicoIndicadores) merged.historicoIndicadores = snap.historicoIndicadores;
    if (snap.valuationModels && !merged.valuationModels) merged.valuationModels = snap.valuationModels;
    if (Array.isArray(snap.sourceComparatives) && snap.sourceComparatives.length && !merged.sourceComparatives) merged.sourceComparatives = snap.sourceComparatives;
    if (Array.isArray(snap.relatedCompanies) && snap.relatedCompanies.length && !merged.relatedCompanies) merged.relatedCompanies = snap.relatedCompanies;
    if (Array.isArray(snap.peerFundamentalComparator) && snap.peerFundamentalComparator.length && !merged.peerFundamentalComparator) merged.peerFundamentalComparator = snap.peerFundamentalComparator;
    if (snap.comparativeGroups && Object.keys(snap.comparativeGroups || {}).length && !merged.comparativeGroups) merged.comparativeGroups = snap.comparativeGroups;
    if (snap.fiiInfo && !merged.fiiInfo) merged.fiiInfo = snap.fiiInfo;
    if (Array.isArray(snap.listaImoveis) && snap.listaImoveis.length && !merged.listaImoveis) merged.listaImoveis = snap.listaImoveis;
    if (Array.isArray(snap.physicalAssets) && snap.physicalAssets.length && !merged.physicalAssets) merged.physicalAssets = snap.physicalAssets;
    if (Array.isArray(snap.statusInvestFiiPortfolio) && snap.statusInvestFiiPortfolio.length && !merged.statusInvestFiiPortfolio) merged.statusInvestFiiPortfolio = snap.statusInvestFiiPortfolio;
    if (snap.statusInvestFiiAccounting && !merged.statusInvestFiiAccounting) merged.statusInvestFiiAccounting = snap.statusInvestFiiAccounting;
    if (Array.isArray(snap.statusInvestIndices) && snap.statusInvestIndices.length && !merged.statusInvestIndices) merged.statusInvestIndices = snap.statusInvestIndices;
    if (Array.isArray(snap.indices) && snap.indices.length && !merged.indices) merged.indices = snap.indices;
    if (snap.distribuicaoAtivosFundo && !merged.distribuicaoAtivosFundo) merged.distribuicaoAtivosFundo = snap.distribuicaoAtivosFundo;
    if (snap.assetDistribution && !merged.assetDistribution) merged.assetDistribution = snap.assetDistribution;
    if (Array.isArray(snap.fiiPeerComparison) && snap.fiiPeerComparison.length && !merged.fiiPeerComparison) merged.fiiPeerComparison = snap.fiiPeerComparison;
    if (Array.isArray(snap.comparadorFiis) && snap.comparadorFiis.length && !merged.comparadorFiis) merged.comparadorFiis = snap.comparadorFiis;
    if (Array.isArray(snap.distribuicoes12m) && snap.distribuicoes12m.length && !merged.distribuicoes12m) merged.distribuicoes12m = snap.distribuicoes12m;
    if (Array.isArray(snap.dividendYieldHistory) && snap.dividendYieldHistory.length && !merged.dividendYieldHistory) merged.dividendYieldHistory = snap.dividendYieldHistory;
    for (const row of snap.sourceFacts || []) {
      if (row?.label && !merged.sourceFacts.some(x => x.label === row.label && String(x.value) === String(row.value))) merged.sourceFacts.push(row);
    }
    for (const row of snap.corporateEvents || []) {
      if (row?.label && !merged.corporateEvents.some(x => x.label === row.label && String(x.value) === String(row.value))) merged.corporateEvents.push(row);
    }
    for (const row of snap.checklistBuyHold || snap.checklist || []) {
      if (row?.label && !merged.checklistBuyHold.some(x => x.label === row.label && String(x.value) === String(row.value))) merged.checklistBuyHold.push(row);
    }
    for (const row of snap.sourceExtractionTechnologies || []) {
      if (row?.id && !merged.sourceExtractionTechnologies.some(x => x.id === row.id)) merged.sourceExtractionTechnologies.push(row);
    }
    for (const report of snap.sourceDriftReports || []) {
      if (report?.provider && !merged.sourceDriftReports.some(x => x.provider === report.provider && x.url === report.url)) merged.sourceDriftReports.push(report);
    }
    for (const card of snap.indicatorCards || []) {
      if (card?.label && !merged.indicatorCards.some(x => x.label === card.label)) merged.indicatorCards.push(card);
    }
    merged.diagnostics.push(...(snap.diagnostics || []));
    if (snap.status === 'OK') merged.status = 'OK';
  }
  return merged;
}

function dividendsToIndicators(events, quotePrice = 0) {
  const nowYear = String(new Date().getUTCFullYear());
  const byYear = new Map();
  const byMonth = new Map();
  for (const ev of events || []) {
    const date = ev.paymentDate || ev.dateCom || ev.eligibilityDate || '';
    const year = String(date).slice(0, 4);
    const month = String(date).slice(0, 7);
    const value = Number(ev.valuePerShare || 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (/^\d{4}$/.test(year)) byYear.set(year, round((byYear.get(year) || 0) + value, 6));
    if (/^\d{4}-\d{2}$/.test(month)) byMonth.set(month, round((byMonth.get(month) || 0) + value, 6));
  }
  const dividendYearly = [...byYear.entries()].sort().map(([year, value]) => ({ label: 'Anual', year, value, display: `R$ ${value.toFixed(4).replace('.', ',')}` }));
  const dividendMonthly = [...byMonth.entries()].sort().slice(-120).map(([period, value]) => ({ label: 'Mensal', period, value, display: `R$ ${value.toFixed(4).replace('.', ',')}` }));
  // Não gerar histórico de DY a partir de dividendos anuais + cotação atual.
  // Essa derivação distorce anos anteriores; histórico de DY só deve vir de série real da fonte.
  const lastYearDividend = byYear.get(nowYear) || byYear.get(String(Number(nowYear) - 1)) || 0;
  return { dividendYearly, dividendMonthly, dividendYieldHistory: [], lastYearDividend };
}

function buildSimpleFinancialSeries(indicators = {}, priceHistory = [], fundamentals = {}) {
  const current = priceHistory.at(-1)?.close || priceHistory.at(-1)?.price || priceHistory.at(-1)?.value || 0;
  const canonicalFinancial = fundamentals.assetChartsCanonical?.financial || fundamentals.financialChartsCanonical || {};
  const canonicalRevenueProfit = Array.isArray(canonicalFinancial.revenueProfit) ? canonicalFinancial.revenueProfit : [];
  const canonicalBalance = Array.isArray(canonicalFinancial.balanceSheet) ? canonicalFinancial.balanceSheet : Array.isArray(canonicalFinancial.equityEvolution) ? canonicalFinancial.equityEvolution : [];
  const canonicalProfitVsQuote = Array.isArray(canonicalFinancial.profitVsQuote) ? canonicalFinancial.profitVsQuote : [];
  const canonicalCashFlow = Array.isArray(canonicalFinancial.cashFlowStatement) ? canonicalFinancial.cashFlowStatement : [];
  const canonicalIncome = Array.isArray(canonicalFinancial.incomeStatement) ? canonicalFinancial.incomeStatement : [];
  if (canonicalRevenueProfit.length || canonicalBalance.length || canonicalProfitVsQuote.length || canonicalCashFlow.length || canonicalIncome.length) {
    return { revenueProfit: canonicalRevenueProfit.length ? canonicalRevenueProfit : canonicalIncome, balance: canonicalBalance, profitVsQuote: canonicalProfitVsQuote, cashFlow: canonicalCashFlow, incomeStatement: canonicalIncome };
  }
  const provided = fundamentals.financialSeries || {};
  const revenueProfitProvided = Array.isArray(provided.revenueProfit) ? provided.revenueProfit : [];
  const balanceProvided = Array.isArray(provided.balance) ? provided.balance : [];
  const profitVsQuoteProvided = Array.isArray(provided.profitVsQuote) ? provided.profitVsQuote : [];
  if (revenueProfitProvided.length || balanceProvided.length || profitVsQuoteProvided.length) {
    return { revenueProfit: revenueProfitProvided, balance: balanceProvided, profitVsQuote: profitVsQuoteProvided, cashFlow: Array.isArray(provided.cashFlow) ? provided.cashFlow : [], incomeStatement: Array.isArray(provided.incomeStatement) ? provided.incomeStatement : [] };
  }
  // Nunca sintetizar DRE, Balanço, Fluxo de Caixa ou Lucro x Cotação a partir de
  // indicadores pontuais. A página Análise deve exibir somente séries financeiras
  // realmente capturadas de fonte/canonical API/HTML, evitando informação inferida
  // como se fosse demonstração financeira histórica.
  return { balance: [], revenueProfit: [], profitVsQuote: [], cashFlow: [], incomeStatement: [] };
}


function pointDateKey(point = {}) {
  const raw = String(point.month || point.date || point.timestamp || point.time || point.label || '').trim();
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}`;
  const br = raw.match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (br) {
    const year = br[2].length === 2 ? `20${br[2]}` : br[2];
    return `${year}-${String(br[1]).padStart(2, '0')}`;
  }
  return '';
}

function monthLabelFromKey(month = '') {
  return /^\d{4}-\d{2}$/.test(month) ? `${month.slice(5, 7)}/${month.slice(2, 4)}` : month;
}

function monthlyPriceLevels(points = []) {
  const byMonth = new Map();
  for (const point of Array.isArray(points) ? points : []) {
    const month = pointDateKey(point);
    const value = numberValue(point.close ?? point.price ?? point.value, NaN);
    if (!month || !Number.isFinite(value) || value <= 0) continue;
    byMonth.set(month, { month, value, source: point.source });
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function cumulativeReturnsFromPriceLevels(points = [], limit = 18) {
  const levels = monthlyPriceLevels(points).slice(-Math.max(2, Number(limit || 18)));
  const first = levels[0]?.value || 0;
  if (!(first > 0) || levels.length < 2) return [];
  return levels.map(row => ({
    month: row.month,
    label: monthLabelFromKey(row.month),
    value: round(((row.value / first) - 1) * 100, 4),
    display: `${round(((row.value / first) - 1) * 100, 2).toFixed(2)}%`,
    source: row.source
  }));
}

function cumulativeReturnsFromAccumulatedPoints(points = [], limit = 18) {
  const rows = (Array.isArray(points) ? points : [])
    .map(point => {
      const month = pointDateKey(point);
      const value = numberValue(point.accumulatedPercent ?? point.returnPercent ?? point.valuePercent ?? point.value, NaN);
      return { month, value, source: point.source };
    })
    .filter(row => row.month && Number.isFinite(row.value))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-Math.max(2, Number(limit || 18)));
  return rows.map(row => ({
    month: row.month,
    label: monthLabelFromKey(row.month),
    value: round(row.value, 4),
    display: `${round(row.value, 2).toFixed(2)}%`,
    source: row.source
  }));
}

function alignComparisonSeries(assetRows = [], benchmarkRows = []) {
  const assetMap = new Map(assetRows.map(row => [row.month, row]));
  const benchmarkMap = new Map(benchmarkRows.map(row => [row.month, row]));
  const months = [...assetMap.keys()].filter(month => benchmarkMap.has(month)).sort().slice(-18);
  if (months.length < 2) return null;
  return {
    asset: months.map(month => assetMap.get(month)),
    benchmark: months.map(month => benchmarkMap.get(month))
  };
}

async function buildAnalysisComparisonBundle({ ticker, assetClass, priceHistory, range, payload = {} }) {
  const cleanTicker = normalizeTicker(ticker);
  const assetReturns = cumulativeReturnsFromPriceLevels(priceHistory || [], 18);
  if (!cleanTicker || assetReturns.length < 2) {
    return { indexComparison: [], comparisonDiagnostics: [{ provider: 'asset-history', status: 'EMPTY', reason: 'asset-price-history-insufficient' }] };
  }

  const timeoutMs = Number(payload.comparisonTimeoutMs || payload.indexTimeoutMs || payload.timeoutMs || 4200);
  const normalizedRange = normalizeRange(range || payload.range || '1Y');
  const desiredIndexes = String(assetClass || '').toUpperCase() === 'FII'
    ? ['IFIX', 'CDI', 'IPCA', 'IBOV', 'SMLL', 'IDIV', 'IVVB11']
    : ['IBOV', 'CDI', 'IPCA', 'IFIX', 'SMLL', 'IDIV', 'IVVB11'];
  const diagnostics = [];
  const indexComparison = [];

  async function pushBenchmark(code, rows, source, meta = {}) {
    if (!Array.isArray(rows) || rows.length < 2) {
      diagnostics.push({ provider: code, status: 'EMPTY', reason: 'benchmark-insufficient-points' });
      return;
    }
    if (meta.simulated || meta.synthetic || meta.proxyTickerUsed) {
      diagnostics.push({ provider: code, status: 'REJECTED', reason: 'synthetic-or-proxy-benchmark-rejected' });
      return;
    }
    const aligned = alignComparisonSeries(assetReturns, rows);
    if (!aligned) {
      diagnostics.push({ provider: code, status: 'EMPTY', reason: 'no-common-months' });
      return;
    }
    indexComparison.push({
      id: `asset_vs_${code.toLowerCase()}`,
      name: code,
      label: `${cleanTicker} x ${code}`,
      source,
      realOnly: true,
      simulated: false,
      proxyTickerUsed: false,
      series: [
        { id: 'asset', label: cleanTicker, points: aligned.asset },
        { id: code.toLowerCase(), label: code, points: aligned.benchmark }
      ]
    });
    diagnostics.push({ provider: code, status: 'OK', points: aligned.asset.length, source });
  }

  for (const code of desiredIndexes) {
    try {
      if (code === 'CDI') {
        const cdi = await getCdiAccumulatedSeries(18, timeoutMs);
        await pushBenchmark('CDI', cumulativeReturnsFromAccumulatedPoints(cdi.points || cdi.series || [], 18), cdi.source || 'Banco Central SGS CDI oficial', cdi);
      } else if (code === 'IPCA') {
        const ipca = await getIpcaSeries(18);
        await pushBenchmark('IPCA', cumulativeReturnsFromAccumulatedPoints(ipca.points || ipca.series || [], 18), ipca.source || 'Banco Central SGS IPCA oficial', ipca);
      } else {
        const indexHistory = await getAssetHistory({ ...payload, ticker: code, symbol: code, q: code, range: normalizedRange, timeoutMs, yahooTimeoutMs: timeoutMs, limit: 260 });
        await pushBenchmark(code, cumulativeReturnsFromPriceLevels(indexHistory.points || indexHistory.history || indexHistory.series || [], 18), indexHistory.source || `Índice ${code}`, indexHistory);
      }
    } catch (error) {
      diagnostics.push({ provider: code, status: 'ERROR', error: error?.message || String(error) });
    }
  }

  return { indexComparison, comparisonDiagnostics: diagnostics };
}

function buildAssetChartBundle({ ticker, assetClass, quote, fundamentals, history, dividends }) {
  const priceHistory = history?.points || [];
  const events = dividends?.events || [];
  const div = dividendsToIndicators(events, quote?.currentPrice || quote?.price || 0);
  const indicators = fundamentals.indicators || {};
  const canonical = fundamentals.assetChartsCanonical || {};
  const canonicalFii = canonical.fii || {};
  const financial = buildSimpleFinancialSeries(indicators, priceHistory, fundamentals);
  const returns = periodReturnsFromPrices(priceHistory);
  // Checkpoint 28 revisão: comparadores só entram quando forem índices/pares reais.
  // A rentabilidade do próprio ticker permanece em profitability, mas não deve
  // aparecer como se fosse comparação com IBOV/IFIX/CDI/IPCA.
  const indexComparison = [];
  const captured = ['quote', priceHistory.length ? 'priceHistory' : '', fundamentals.indicatorCards?.length ? 'fundamentals' : '', events.length ? 'dividends' : ''].filter(Boolean);
  const missing = [priceHistory.length ? '' : 'priceHistory', fundamentals.indicatorCards?.length ? '' : 'fundamentals'].filter(Boolean);
  return {
    ticker,
    type: assetClass,
    range: history?.range || '1Y',
    source: 'VALORAE Fonte Oficial',
    priceHistory,
    profitability: returns,
    realProfitability: [],
    indicatorCards: fundamentals.indicatorCards || [],
    dividendEvents: events,
    dividendMonthly: div.dividendMonthly,
    dividendYearly: div.dividendYearly,
    dividendYieldHistory: div.dividendYieldHistory,
    indexComparison,
    commodityComparison: [],
    revenueProfit: financial.revenueProfit,
    profitVsQuote: financial.profitVsQuote,
    equityEvolution: financial.balance,
    balanceSheet: financial.balance,
    // Não montar histórico de payout a partir de indicador pontual.
    // A página Análise só deve receber série quando a própria fonte trouxer histórico/tabela/gráfico real.
    payoutHistory: Array.isArray(canonical.financial?.payoutHistory) ? canonical.financial.payoutHistory : [],
    incomeStatement: financial.incomeStatement || [],
    cashFlowStatement: financial.cashFlow || [],
    revenueByRegion: canonical.revenueByRegion || canonical.revenueGeography || canonical.revenueBreakdowns?.region || canonical.revenueBreakdowns?.geography || fundamentals.revenueByRegion || fundamentals.revenueGeography || {},
    revenueByBusiness: canonical.revenueByBusiness || canonical.revenueSegment || canonical.revenueBreakdowns?.business || canonical.revenueBreakdowns?.segment || fundamentals.revenueByBusiness || fundamentals.revenueSegment || {},
    fiiDistribution12m: Array.isArray(canonicalFii.distribution12m) && canonicalFii.distribution12m.length ? canonicalFii.distribution12m : div.dividendMonthly,
    fiiPeerAverage: Array.isArray(canonicalFii.peerComparison) ? canonicalFii.peerComparison : [],
    fiiPatrimonialInfo: canonicalFii.info && Object.keys(canonicalFii.info).length ? canonicalFii.info : (fundamentals.indicatorCards?.filter(x => /vacância|cotistas|cotas|patrimônio/i.test(x.label)) || []),
    fiiAssetDistribution: canonicalFii.assetDistribution || {},
    fiiPhysicalAssets: canonicalFii.physicalAssets || [],
    warnings: missing.length ? [`Campos ainda indisponíveis: ${missing.join(', ')}`] : [],
    coverageCaptured: captured,
    coverageMissing: missing,
    coverageNotApplicable: assetClass === 'FII' ? ['commodityComparison'] : ['fiiAssetDistribution']
  };
}

export async function buildAssetDetails(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q);
  if (!ticker) return { status: 'EMPTY', ticker: '', assetChartBundle: null };
  const modalFast = String(payload.mode || payload.priority || '').toLowerCase().includes('modal_fast') || String(payload.priority || '').toLowerCase().includes('essential');
  const range = normalizeRange(payload.range || payload.period || (modalFast ? '6M' : '1Y'));
  const [quote, history, htmlFundamentals, yahooFundamentals, dividends] = await Promise.all([
    getQuote(ticker, { timeoutMs: Number(payload.quoteTimeoutMs || payload.timeoutMs || 3500) }).catch(error => ({ status: 'ERROR', ticker, price: 0, error: error?.message })),
    getAssetHistory({ ...payload, ticker, range }).catch(error => ({ status: 'ERROR', ticker, points: [], history: [], series: [], chartHistory: [], error: error?.message })),
    fetchFundamentalSnapshot(ticker, { timeoutMs: Number(payload.fundamentalTimeoutMs || payload.timeoutMs || 4200) }).catch(error => ({ status: 'ERROR', indicators: {}, indicatorCards: [], profile: {}, diagnostics: [{ provider: 'html', error: error?.message }] })),
    fetchYahooFundamentalSnapshot(ticker, { timeoutMs: Number(payload.yahooTimeoutMs || payload.timeoutMs || 4200) }).catch(error => ({ status: 'ERROR', indicators: {}, indicatorCards: [], profile: {}, diagnostics: [{ provider: 'yahoo-summary', error: error?.message }] })),
    getConfirmedDividendsByTicker(ticker, { timeoutMs: Number(payload.dividendTimeoutMs || 4200) }).catch(error => ({ events: [], diagnostics: [{ error: error?.message }] }))
  ]);
  const fundamentals = mergeFundamentalSnapshots(htmlFundamentals, yahooFundamentals);
  const assetClass = classifyTicker(ticker);
  const indicators = fundamentals.indicators || {};
  const div = dividendsToIndicators(dividends.events || [], quote?.currentPrice || quote?.price || 0);
  const dividendYield = numberValue(indicators.dividendYield, 0) || (quote?.price > 0 && div.lastYearDividend > 0 ? round((div.lastYearDividend / quote.price) * 100, 2) : 0);
  const bundle = buildAssetChartBundle({ ticker, assetClass, quote, fundamentals, history, dividends });
  const liveComparisons = modalFast
    ? { indexComparison: [], comparisonDiagnostics: [{ provider: 'analysis-comparisons', status: 'SKIPPED', reason: 'modal_fast' }] }
    : await buildAnalysisComparisonBundle({
      ticker,
      assetClass,
      priceHistory: history.points || history.history || [],
      range,
      payload
    }).catch(error => ({ indexComparison: [], comparisonDiagnostics: [{ provider: 'analysis-comparisons', status: 'ERROR', error: error?.message || String(error) }] }));
  bundle.indexComparison = liveComparisons.indexComparison || [];
  bundle.comparisonDiagnostics = liveComparisons.comparisonDiagnostics || [];
  const description = fundamentals.profile?.description || '';
  const historicalIndicators = fundamentals.historicoIndicadores || fundamentals.assetChartsCanonical?.company?.fundamentalIndicatorHistory || fundamentals.assetChartsCanonical?.fii?.fundamentalIndicatorHistory || fundamentals.assetChartsCanonical?.fundamentalIndicatorHistory || null;
  const valuationModels = fundamentals.valuationModels || fundamentals.assetChartsCanonical?.company?.valuationModels || {};
  const sourceComparatives = fundamentals.sourceComparatives || (fundamentals.indicatorCards || []).filter(card => card?.comparisons && Object.keys(card.comparisons).length) || [];
  const relatedCompanies = fundamentals.relatedCompanies || fundamentals.peerFundamentalComparator || [];
  const comparativeGroups = fundamentals.comparativeGroups || {};
  const sourceIndices = fundamentals.statusInvestIndices || fundamentals.indices || [];
  const sourceFacts = fundamentals.sourceFacts || [];
  const corporateEvents = fundamentals.corporateEvents || [];
  const checklistBuyHold = fundamentals.checklistBuyHold || [];
  const sourceExtractionTechnologies = fundamentals.sourceExtractionTechnologies || [];
  const statusInvestFiiAccounting = fundamentals.statusInvestFiiAccounting || {};
  const ownership = fundamentals.ownership || fundamentals.assetChartsCanonical?.company?.ownership || fundamentals.assetChartsCanonical?.company?.shareholders || fundamentals.assetChartsCanonical?.ownership || fundamentals.assetChartsCanonical?.shareholders || null;
  const canonicalFii = fundamentals.assetChartsCanonical?.fii || {};
  const fiiInfo = fundamentals.fiiInfo || canonicalFii.info || {};
  const fiiPhysicalAssets = fundamentals.physicalAssets || fundamentals.listaImoveis || canonicalFii.physicalAssets || [];
  const statusInvestFiiPortfolio = fundamentals.statusInvestFiiPortfolio || [];
  const fiiAssetDistribution = fundamentals.distribuicaoAtivosFundo || fundamentals.assetDistribution || canonicalFii.assetDistribution || [];
  const fiiPeerComparison = fundamentals.fiiPeerComparison || fundamentals.comparadorFiis || canonicalFii.peerComparison || [];
  const fiiDistribution12m = fundamentals.distribuicoes12m || canonicalFii.distribution12m || [];
  const fiiDividendYieldHistory = fundamentals.dividendYieldHistory || canonicalFii.dividendYieldHistory || [];
  const normalized = {
    precoAtual: quote?.currentPrice || quote?.price || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    ...indicators
  };
  const results = {
    ticker,
    symbol: ticker,
    type: assetClass,
    assetClass,
    nome: ticker,
    nomeEmpresa: ticker,
    precoAtual: quote?.currentPrice || quote?.price || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    dy: dividendYield,
    ultimoRendimento: (dividends.events || []).find(e => dateMillis(e.paymentDate || e.dateCom) <= Date.now())?.valuePerShare || 0,
    ...indicators,
    cotacao: {
      precoAtual: quote?.currentPrice || quote?.price || 0,
      variacaoDay: quote?.changePercent || 0,
      max52Semanas: 0,
      min52Semanas: 0
    },
    indicadores: { dividendYield, ...indicators },
    indicadoresFundamentalistas: { semComparativos: { dividendYield, ...indicators }, comparativosFonte: sourceComparatives, comparadorSegmento: relatedCompanies },
    sourceComparatives,
    valuationModels,
    indices: sourceIndices,
    statusInvestIndices: sourceIndices,
    sourceFacts,
    corporateEvents,
    checklistBuyHold,
    sourceExtractionTechnologies,
    sourceDriftReports: fundamentals.sourceDriftReports || [],
    statusInvestFiiAccounting: assetClass === 'FII' ? statusInvestFiiAccounting : {},
    dadosEmpresa: { nome: ticker, setor: fundamentals.profile?.sector || '', subsetor: fundamentals.profile?.industry || '' },
    informacoesEmpresa: { ...(fundamentals.assetChartsCanonical?.info || {}), ...(fundamentals.financialSummary || {}), valorDeMercado: indicators.valorDeMercado || fundamentals.financialSummary?.valorDeMercado || 0, marketCap: indicators.valorDeMercado || fundamentals.financialSummary?.valorDeMercado || 0, patrimonioLiquido: indicators.patrimonioLiquido || fundamentals.financialSummary?.patrimonioLiquido || 0, equity: indicators.patrimonioLiquido || fundamentals.financialSummary?.patrimonioLiquido || 0, valorDeFirma: indicators.valorDeFirma || fundamentals.financialSummary?.valorDeFirma || fundamentals.assetChartsCanonical?.info?.['Valor de firma'] || fundamentals.assetChartsCanonical?.info?.['Valor da firma'] || 0, enterpriseValue: indicators.valorDeFirma || fundamentals.financialSummary?.valorDeFirma || fundamentals.assetChartsCanonical?.info?.['Valor de firma'] || fundamentals.assetChartsCanonical?.info?.['Valor da firma'] || 0, liquidezMediaDiaria: indicators.liquidezMediaDiaria || 0, dailyLiquidity: indicators.liquidezMediaDiaria || 0, setor: fundamentals.profile?.sector || '', subsetor: fundamentals.profile?.industry || '' },
    informacoesFundo: assetClass === 'FII' ? { ...fiiInfo, segmento: fundamentals.profile?.industry || fiiInfo.segmento || fiiInfo.SEGMENTO || '', patrimonioLiquido: indicators.patrimonioLiquido || fundamentals.financialSummary?.patrimonioLiquido || fiiInfo.valorPatrimonial || fiiInfo['VALOR PATRIMONIAL'] || 0, vacanciaFisica: indicators.vacanciaFisica || fiiInfo.vacancia || fiiInfo['VACÂNCIA'] || 0, numeroCotistas: indicators.cotistas || indicators.numeroCotistas || fiiInfo.numeroCotistas || fiiInfo['NUMERO DE COTISTAS'] || 0, cotasEmitidas: indicators.cotasEmitidas || fiiInfo.cotasEmitidas || fiiInfo['COTAS EMITIDAS'] || 0 } : {},
    fiiInfo: assetClass === 'FII' ? fiiInfo : {},
    listaImoveis: assetClass === 'FII' ? fiiPhysicalAssets : [],
    imoveis: assetClass === 'FII' ? fiiPhysicalAssets : [],
    physicalAssets: assetClass === 'FII' ? fiiPhysicalAssets : [],
    statusInvestFiiPortfolio: assetClass === 'FII' ? statusInvestFiiPortfolio : [],
    statusInvestFiiAccounting: assetClass === 'FII' ? statusInvestFiiAccounting : {},
    indices: sourceIndices,
    statusInvestIndices: sourceIndices,
    distribuicaoAtivosFundo: assetClass === 'FII' ? fiiAssetDistribution : [],
    assetDistribution: assetClass === 'FII' ? fiiAssetDistribution : [],
    fiiPeerComparison: assetClass === 'FII' ? fiiPeerComparison : [],
    comparadorFiis: assetClass === 'FII' ? fiiPeerComparison : [],
    distribuicoes12m: assetClass === 'FII' ? fiiDistribution12m : [],
    dividendYieldHistory: assetClass === 'FII' && fiiDividendYieldHistory.length ? fiiDividendYieldHistory : div.dividendYieldHistory,
    historicoPrecos: history.points || [],
    proventos: dividends.events || [],
    dividends: dividends.events || [],
    financialSummary: fundamentals.financialSummary || {},
    indicadoresAvancados: { ...indicators },
    valuation: { pl: indicators.pl || 0, pvp: indicators.pvp || 0, psr: indicators.psr || 0, evEbitda: indicators.evEbitda || 0, evEbit: indicators.evEbit || 0 },
    profitability: { roe: indicators.roe || 0, roa: indicators.roa || 0, roic: indicators.roic || 0, margemLiquida: indicators.margemLiquida || 0, margemBruta: indicators.margemBruta || 0 },
    debt: { dividaBruta: indicators.dividaBruta || 0, dividaLiquida: indicators.dividaLiquida || 0, dividaLiquidaEbitda: indicators.dividaLiquidaEbitda || 0 },
    statements: { revenueProfit: bundle.revenueProfit, incomeStatement: bundle.incomeStatement, balanceSheet: bundle.balanceSheet, equityEvolution: bundle.equityEvolution, cashFlowStatement: bundle.cashFlowStatement },
    financialChartsCanonical: fundamentals.financialChartsCanonical || fundamentals.assetChartsCanonical?.financial || {},
    assetChartsCanonical: fundamentals.assetChartsCanonical || {},
    valuationModels,
    sourceComparatives,
    relatedCompanies,
    peerFundamentalComparator: relatedCompanies,
    comparativeGroups,
    peers: relatedCompanies,
    comparadorAcoes: relatedCompanies,
    indices: sourceIndices,
    statusInvestIndices: sourceIndices,
    sourceFacts,
    corporateEvents,
    checklistBuyHold,
    sourceExtractionTechnologies,
    sourceDriftReports: fundamentals.sourceDriftReports || [],
    statusInvestFiiAccounting: assetClass === 'FII' ? statusInvestFiiAccounting : {},
    revenueGeography: fundamentals.revenueGeography || bundle.revenueByRegion,
    revenueSegment: fundamentals.revenueSegment || bundle.revenueByBusiness,
    revenueByRegion: fundamentals.revenueByRegion || bundle.revenueByRegion,
    revenueByBusiness: fundamentals.revenueByBusiness || bundle.revenueByBusiness,
    fiiInfo: assetClass === 'FII' ? fiiInfo : {},
    listaImoveis: assetClass === 'FII' ? fiiPhysicalAssets : [],
    imoveis: assetClass === 'FII' ? fiiPhysicalAssets : [],
    physicalAssets: assetClass === 'FII' ? fiiPhysicalAssets : [],
    statusInvestFiiPortfolio: assetClass === 'FII' ? statusInvestFiiPortfolio : [],
    statusInvestFiiAccounting: assetClass === 'FII' ? statusInvestFiiAccounting : {},
    indices: sourceIndices,
    statusInvestIndices: sourceIndices,
    distribuicaoAtivosFundo: assetClass === 'FII' ? fiiAssetDistribution : [],
    assetDistribution: assetClass === 'FII' ? fiiAssetDistribution : [],
    fiiPeerComparison: assetClass === 'FII' ? fiiPeerComparison : [],
    comparadorFiis: assetClass === 'FII' ? fiiPeerComparison : [],
    distribuicoes12m: assetClass === 'FII' ? fiiDistribution12m : [],
    dividendYieldHistory: assetClass === 'FII' && fiiDividendYieldHistory.length ? fiiDividendYieldHistory : div.dividendYieldHistory,
    chartsFinanceiros: fundamentals.chartsFinanceiros || {},
    historicoIndicadores: historicalIndicators,
    fundamentalIndicatorHistory: historicalIndicators,
    ownership,
    shareholders: ownership?.rows || ownership,
    posicaoAcionaria: ownership,
    assetChartBundle: bundle,
    assetChartsMobile: bundle,
    sections: { indicadores: { dividendYield, ...indicators }, historicoIndicadores: historicalIndicators, assetChartBundle: bundle, assetChartsMobile: bundle, demonstrativos: { revenueProfit: bundle.revenueProfit, incomeStatement: bundle.incomeStatement, balanceSheet: bundle.balanceSheet, equityEvolution: bundle.equityEvolution, cashFlowStatement: bundle.cashFlowStatement }, comparativosFonte: sourceComparatives, indices: sourceIndices, empresa: { revenueGeography: fundamentals.revenueGeography || bundle.revenueByRegion, revenueByRegion: fundamentals.revenueByRegion || bundle.revenueByRegion, revenueSegment: fundamentals.revenueSegment || bundle.revenueByBusiness, revenueByBusiness: fundamentals.revenueByBusiness || bundle.revenueByBusiness, valuationModels, sourceComparatives, relatedCompanies, peerFundamentalComparator: relatedCompanies, comparativeGroups, indices: sourceIndices, sourceFacts, corporateEvents, checklistBuyHold, posicaoAcionaria: ownership }, fundo: { sourceFacts, corporateEvents, checklistBuyHold, sourceExtractionTechnologies, informacoesFundo: assetClass === 'FII' ? { ...fiiInfo, segmento: fundamentals.profile?.industry || fiiInfo.segmento || fiiInfo.SEGMENTO || '', ...statusInvestFiiAccounting } : {}, listaImoveis: assetClass === 'FII' ? fiiPhysicalAssets : [], imoveis: assetClass === 'FII' ? fiiPhysicalAssets : [], physicalAssets: assetClass === 'FII' ? fiiPhysicalAssets : [], statusInvestFiiPortfolio: assetClass === 'FII' ? statusInvestFiiPortfolio : [], distribuicaoAtivosFundo: assetClass === 'FII' ? fiiAssetDistribution : [], assetDistribution: assetClass === 'FII' ? fiiAssetDistribution : [], comparadorFiis: assetClass === 'FII' ? fiiPeerComparison : [], indices: sourceIndices, contabilidade: assetClass === 'FII' ? { ...fundamentals.financialSummary, ...fiiInfo, ...statusInvestFiiAccounting } : {}, historicoIndicadores: historicalIndicators } }
  };
  return {
    status: (quote?.price > 0 || bundle.priceHistory.length || bundle.indicatorCards.length || bundle.dividendEvents.length) ? 'OK' : 'PARTIAL',
    ticker,
    symbol: ticker,
    type: assetClass,
    assetClass,
    isFii: assetClass === 'FII',
    name: ticker,
    source: 'VALORAE Fonte Oficial',
    price: quote?.price || 0,
    currentPrice: quote?.currentPrice || quote?.price || 0,
    precoAtual: quote?.currentPrice || quote?.price || 0,
    changePercent: quote?.changePercent || 0,
    variacaoDay: quote?.changePercent || 0,
    dividendYield,
    dy: dividendYield,
    pvp: indicators.pvp || 0,
    pl: indicators.pl || 0,
    roe: indicators.roe || 0,
    roic: indicators.roic || 0,
    roa: indicators.roa || 0,
    payout: indicators.payout || 0,
    margemLiquida: indicators.margemLiquida || 0,
    margemBruta: indicators.margemBruta || 0,
    margemEbit: indicators.margemEbit || 0,
    margemEbitda: indicators.margemEbitda || 0,
    valorDeMercado: indicators.valorDeMercado || 0,
    marketCap: indicators.valorDeMercado || 0,
    valorDeFirma: indicators.valorDeFirma || 0,
    enterpriseValue: indicators.valorDeFirma || 0,
    patrimonioLiquido: indicators.patrimonioLiquido || 0,
    equity: indicators.patrimonioLiquido || 0,
    liquidezMediaDiaria: indicators.liquidezMediaDiaria || 0,
    dailyLiquidity: indicators.liquidezMediaDiaria || 0,
    assetDescription: description,
    subSector: fundamentals.profile?.industry || '',
    sector: fundamentals.profile?.sector || '',
    subsetor: fundamentals.profile?.industry || '',
    fiiSegment: assetClass === 'FII' ? (fundamentals.profile?.industry || '') : '',
    normalized,
    indicators: { dividendYield, ...indicators },
    fundamentos: { dividendYield, ...indicators },
    fundamentals: { dividendYield, ...indicators },
    financialSummary: fundamentals.financialSummary || {},
    indicadoresAvancados: { ...indicators },
    quote,
    cotacao: results.cotacao,
    results,
    valuation: { pl: indicators.pl || 0, pvp: indicators.pvp || 0, psr: indicators.psr || 0, evEbitda: indicators.evEbitda || 0, evEbit: indicators.evEbit || 0 },
    profitability: { roe: indicators.roe || 0, roa: indicators.roa || 0, roic: indicators.roic || 0, margemLiquida: indicators.margemLiquida || 0, margemBruta: indicators.margemBruta || 0 },
    debt: { dividaBruta: indicators.dividaBruta || 0, dividaLiquida: indicators.dividaLiquida || 0, dividaLiquidaEbitda: indicators.dividaLiquidaEbitda || 0 },
    statements: { revenueProfit: bundle.revenueProfit, incomeStatement: bundle.incomeStatement, balanceSheet: bundle.balanceSheet, equityEvolution: bundle.equityEvolution, cashFlowStatement: bundle.cashFlowStatement },
    financialChartsCanonical: fundamentals.financialChartsCanonical || fundamentals.assetChartsCanonical?.financial || {},
    assetChartsCanonical: fundamentals.assetChartsCanonical || {},
    valuationModels,
    sourceComparatives,
    relatedCompanies,
    peerFundamentalComparator: relatedCompanies,
    comparativeGroups,
    peers: relatedCompanies,
    comparadorAcoes: relatedCompanies,
    indices: sourceIndices,
    statusInvestIndices: sourceIndices,
    sourceFacts,
    corporateEvents,
    checklistBuyHold,
    sourceExtractionTechnologies,
    sourceDriftReports: fundamentals.sourceDriftReports || [],
    statusInvestFiiAccounting: assetClass === 'FII' ? statusInvestFiiAccounting : {},
    revenueGeography: fundamentals.revenueGeography || bundle.revenueByRegion,
    revenueSegment: fundamentals.revenueSegment || bundle.revenueByBusiness,
    revenueByRegion: fundamentals.revenueByRegion || bundle.revenueByRegion,
    revenueByBusiness: fundamentals.revenueByBusiness || bundle.revenueByBusiness,
    chartsFinanceiros: fundamentals.chartsFinanceiros || {},
    historicoIndicadores: historicalIndicators,
    fundamentalIndicatorHistory: historicalIndicators,
    ownership,
    shareholders: ownership?.rows || ownership,
    posicaoAcionaria: ownership,
    assetChartBundle: bundle,
    assetChartsMobile: bundle,
    appPayload: { quote, metrics: { canonical: normalized }, charts: { assetChartBundle: bundle } },
    appMobileSnapshot: { quote, metrics: normalized, assetChartBundle: bundle },
    diagnostics: {
      quote: quote?.status,
      history: history?.status,
      fundamentals: fundamentals?.status,
      dividendCount: dividends.events?.length || 0,
      fundamentalDiagnostics: fundamentals.diagnostics || [],
      sourceExtractionTechnologies,
      sourceDriftReports: fundamentals.sourceDriftReports || []
    },
    coverage: { captured: bundle.coverageCaptured, missing: bundle.coverageMissing },
    partial: bundle.coverageMissing.length > 0
  };
}

export const _test = { percentMetric, mergeFundamentalSnapshots, yahooFinancialSeries, buildSimpleFinancialSeries, parseMetricsFromHtml, extractInvestidor10EmbeddedAnalysisData, extractInvestidor10InlineJson, extractInvestidor10OwnershipFromHtml, extractStatusInvestFiiPortfolioFromHtml, extractStatusInvestFiiAccountingFromHtml, extractStatusInvestFiiHighlightsFromHtml, extractStatusInvestIndicesFromHtml, extractInvestidor10ValuationModelsFromHtml, extractPageDeepCoverageFromHtml, extractInvestidor10ChecklistFromHtml, extractStatusInvestCorporateEventsFromHtml, extractStatusInvestStockDeepFieldsFromHtml, extractStatusInvestStockLendingFromHtml, extractStatusInvestFiiDividendSnapshotFromHtml, extractInvestidor10FiiInfoFactsFromHtml, extractStatusInvestCalendarEventsFromHtml, fetchInvestidor10AnalysisExtras };
