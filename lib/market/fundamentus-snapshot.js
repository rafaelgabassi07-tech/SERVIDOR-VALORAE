import { fetchText } from '../sources/fetch.js';
import { classifyTicker, normalizeTicker, uniqueTickers } from '../core/tickers.js';
import { round } from '../core/numbers.js';

const SNAPSHOT_VERSION = '21.12.191-fundamentus-discovery-snapshot-v1';
const CACHE_TTL_MS = Number(process.env.VALORAE_FUNDAMENTUS_SNAPSHOT_TTL_MS || 45 * 60 * 1000);
const REQUEST_TIMEOUT_MS = Number(process.env.VALORAE_FUNDAMENTUS_SNAPSHOT_TIMEOUT_MS || 5200);
const cache = new Map();

const SOURCES = Object.freeze({
  stocks: 'https://www.fundamentus.com.br/resultado.php',
  fiis: 'https://www.fundamentus.com.br/fii_resultado.php',
});

function decodeEntities(input = '') {
  return String(input || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ccedil;|&#231;/gi, 'ç')
    .replace(/&atilde;|&#227;/gi, 'ã')
    .replace(/&aacute;|&#225;/gi, 'á')
    .replace(/&eacute;|&#233;/gi, 'é')
    .replace(/&iacute;|&#237;/gi, 'í')
    .replace(/&oacute;|&#243;/gi, 'ó')
    .replace(/&uacute;|&#250;/gi, 'ú')
    .replace(/&acirc;|&#226;/gi, 'â')
    .replace(/&ecirc;|&#234;/gi, 'ê')
    .replace(/&ocirc;|&#244;/gi, 'ô');
}

function cleanText(input = '') {
  return decodeEntities(String(input || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHeader(input = '') {
  return cleanText(input)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function parsePtNumber(raw = '') {
  if (raw === null || raw === undefined) return null;
  const cleaned = cleanText(raw);
  if (!cleaned || /^[-—–]+$/.test(cleaned)) return null;
  let s = cleaned.replace(/R\$|%/gi, '').replace(/\s+/g, '').trim();
  const negative = /^-/.test(s);
  s = s.replace(/^[+-]/, '');
  if (!s || /^[-—–]+$/.test(s)) return null;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

function ensureMoneyDisplay(raw = '', value = null) {
  const display = cleanText(raw);
  if (display && !/^[-—–]+$/.test(display)) {
    return /^R\$/i.test(display) ? display : `R$ ${display}`;
  }
  if (Number.isFinite(Number(value)) && Number(value) > 0) return `R$ ${Number(value).toFixed(2).replace('.', ',')}`;
  return '';
}

function ensurePercentDisplay(raw = '', value = null) {
  const display = cleanText(raw);
  if (display && !/^[-—–]+$/.test(display)) return display.includes('%') ? display : `${display}%`;
  if (Number.isFinite(Number(value))) return `${Number(value).toFixed(2).replace('.', ',')}%`;
  return '';
}

function ensureNumberDisplay(raw = '', value = null) {
  const display = cleanText(raw);
  if (display && !/^[-—–]+$/.test(display)) return display;
  if (Number.isFinite(Number(value))) return Number(value).toFixed(2).replace('.', ',');
  return '';
}

function cellsFromRow(row = '') {
  const cells = [];
  const re = /<t[dh]\b[\s\S]*?<\/t[dh]>/gi;
  let m;
  while ((m = re.exec(String(row || '')))) cells.push(m[0]);
  return cells;
}

function findIndex(headers = [], aliases = []) {
  const normalizedAliases = aliases.map(normalizeHeader).filter(Boolean);
  return headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
}

function tickerFromCell(raw = '') {
  const href = String(raw || '').match(/>((?:[A-Z]{4}\d{1,2}[A-Z]?|[A-Z0-9]{3,6}\d{1,2}))</i)?.[1];
  const textTicker = cleanText(raw).match(/\b(?:[A-Z]{4}\d{1,2}[A-Z]?|[A-Z0-9]{3,6}\d{1,2})\b/i)?.[0];
  return normalizeTicker(href || textTicker || '');
}

function mapRow(cells, indexes, kind = 'stocks') {
  const ticker = tickerFromCell(cells[indexes.ticker] || cells[0]);
  if (!ticker) return null;
  const priceRaw = cells[indexes.price] || '';
  const dyRaw = cells[indexes.dy] || '';
  const pvpRaw = cells[indexes.pvp] || '';
  const liquidityRaw = cells[indexes.liquidity] || '';
  const price = parsePtNumber(priceRaw);
  const dividendYield = parsePtNumber(dyRaw);
  const pvp = parsePtNumber(pvpRaw);
  const dailyLiquidity = parsePtNumber(liquidityRaw);
  const name = cleanText(cells[indexes.name] || '') || undefined;
  const sector = cleanText(cells[indexes.sector] || '') || undefined;
  const segment = cleanText(cells[indexes.segment] || '') || undefined;

  return {
    ticker,
    symbol: ticker,
    assetClass: classifyTicker(ticker),
    type: classifyTicker(ticker),
    source: kind === 'fiis' ? 'Fundamentus FIIs' : 'Fundamentus Ações',
    fundamentalSource: kind === 'fiis' ? 'Fundamentus FIIs' : 'Fundamentus Ações',
    fundamentalsSnapshotVersion: SNAPSHOT_VERSION,
    ...(name ? { name, nome: name } : {}),
    ...(sector ? { sector, setor: sector } : {}),
    ...(segment ? { segment, segmento: segment } : {}),
    ...(Number.isFinite(price) && price > 0 ? {
      price: round(price, 4),
      currentPrice: round(price, 4),
      precoAtual: round(price, 4),
      priceDisplay: ensureMoneyDisplay(priceRaw, price),
      cotacao: ensureMoneyDisplay(priceRaw, price),
      preco: ensureMoneyDisplay(priceRaw, price),
    } : {}),
    ...(Number.isFinite(pvp) ? {
      pvp: round(pvp, 4),
      priceToBook: round(pvp, 4),
      pvpDisplay: ensureNumberDisplay(pvpRaw, pvp),
      pVpDisplay: ensureNumberDisplay(pvpRaw, pvp),
      'P/VP': ensureNumberDisplay(pvpRaw, pvp),
    } : {}),
    ...(Number.isFinite(dividendYield) ? {
      dividendYield: round(dividendYield, 4),
      dy: round(dividendYield, 4),
      yield12m: round(dividendYield, 4),
      dividendYieldDisplay: ensurePercentDisplay(dyRaw, dividendYield),
      dyDisplay: ensurePercentDisplay(dyRaw, dividendYield),
      DY: ensurePercentDisplay(dyRaw, dividendYield),
    } : {}),
    ...(Number.isFinite(dailyLiquidity) && dailyLiquidity > 0 ? {
      dailyLiquidity: round(dailyLiquidity, 2),
      averageDailyLiquidity: round(dailyLiquidity, 2),
      liquidezMediaDiaria: round(dailyLiquidity, 2),
      liquidezDiaria: round(dailyLiquidity, 2),
      dailyLiquidityDisplay: ensureMoneyDisplay(liquidityRaw, dailyLiquidity),
      averageDailyLiquidityDisplay: ensureMoneyDisplay(liquidityRaw, dailyLiquidity),
      liquidezMediaDiariaDisplay: ensureMoneyDisplay(liquidityRaw, dailyLiquidity),
      liquidityDisplay: ensureMoneyDisplay(liquidityRaw, dailyLiquidity),
    } : {}),
  };
}

function parseTable(html = '', kind = 'stocks') {
  const rows = String(html || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  if (!rows.length) return [];
  const headerRow = rows.find(row => /<th\b/i.test(row)) || rows[0];
  const headers = cellsFromRow(headerRow).map(cleanText);
  const ticker = findIndex(headers, ['Papel', 'Ticker', 'Código', 'Codigo', 'Ativo']);
  const price = findIndex(headers, ['Cotação', 'Cotacao', 'Preço', 'Preco', 'Preço Atual', 'Preco Atual', 'Valor Atual', 'Última Cotação', 'Ultima Cotacao']);
  const pvp = findIndex(headers, ['P/VP', 'PVP', 'P VP', 'P/VPA', 'P VPA', 'Preço/VP', 'Preco/VP']);
  const dy = findIndex(headers, ['Div.Yield', 'Div Yield', 'Dividend Yield', 'DY', 'Yield', 'Dividendo Yield']);
  const liquidity = findIndex(headers, ['Liq.2meses', 'Liq 2 meses', 'Liq. 2 meses', 'Liquidez 2 meses', 'Liquidez Média Diária', 'Liquidez Media Diaria', 'Liq. Diária', 'Liq Diaria', 'Liquidez Diária', 'Liquidez Diaria', 'Volume Médio', 'Volume Medio']);
  const name = findIndex(headers, ['Nome', 'Empresa', 'Razão Social', 'Razao Social', 'Fundo']);
  const sector = findIndex(headers, ['Setor']);
  const segment = findIndex(headers, ['Segmento', 'Tipo']);
  const indexes = {
    ticker: ticker >= 0 ? ticker : 0,
    price: price >= 0 ? price : (kind === 'fiis' ? 2 : 1),
    dy: dy >= 0 ? dy : (kind === 'fiis' ? 4 : 5),
    pvp: pvp >= 0 ? pvp : (kind === 'fiis' ? 5 : 3),
    liquidity: liquidity >= 0 ? liquidity : (kind === 'fiis' ? 7 : 19),
    name,
    sector,
    segment,
  };
  return rows
    .filter(row => !/<th\b/i.test(row))
    .map(row => cellsFromRow(row))
    .filter(cells => cells.length >= 3)
    .map(cells => mapRow(cells, indexes, kind))
    .filter(Boolean);
}

async function fetchOne(kind, url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || REQUEST_TIMEOUT_MS);
  const response = await fetchText(url, {
    timeoutMs,
    ttlMs: CACHE_TTL_MS,
    staleMs: CACHE_TTL_MS * 4,
    headers: {
      'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'Referer': 'https://www.fundamentus.com.br/',
    },
    retries: 0,
  });
  const rows = parseTable(response.text || '', kind);
  return { kind, url, status: response.status, cacheStatus: response.cacheStatus, rows, count: rows.length };
}

async function fetchSnapshot(options = {}) {
  const key = `fundamentus-snapshot:${SNAPSHOT_VERSION}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.data, cache: 'MEMORY_HIT' };
  const [stocks, fiis] = await Promise.all([
    fetchOne('stocks', SOURCES.stocks, options).catch(error => ({ kind: 'stocks', rows: [], error: error?.message || String(error) })),
    fetchOne('fiis', SOURCES.fiis, options).catch(error => ({ kind: 'fiis', rows: [], error: error?.message || String(error) })),
  ]);
  const byTicker = new Map();
  for (const row of [...(stocks.rows || []), ...(fiis.rows || [])]) {
    if (row?.ticker) byTicker.set(row.ticker, row);
  }
  const data = {
    status: byTicker.size ? 'OK' : 'EMPTY',
    source: 'Fundamentus',
    version: SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    byTicker,
    diagnostics: [stocks, fiis].map(item => ({ kind: item.kind, status: item.status || 0, cacheStatus: item.cacheStatus || '', count: item.count || 0, error: item.error || undefined })),
  };
  if (byTicker.size) cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

export async function getFundamentusSnapshotForTickers(tickers = [], options = {}) {
  const clean = uniqueTickers(tickers);
  if (!clean.length) return { status: 'EMPTY', items: [], byTicker: new Map(), diagnostics: [], source: 'Fundamentus', version: SNAPSHOT_VERSION };
  const snapshot = await fetchSnapshot(options);
  const items = clean.map(ticker => snapshot.byTicker?.get(ticker)).filter(Boolean);
  return {
    status: items.length ? 'OK' : snapshot.status,
    source: snapshot.source,
    version: SNAPSHOT_VERSION,
    generatedAt: snapshot.generatedAt,
    items,
    byTicker: new Map(items.map(item => [item.ticker, item])),
    diagnostics: snapshot.diagnostics || [],
  };
}

export const _test = { cleanText, normalizeHeader, parsePtNumber, parseTable, getFundamentusSnapshotForTickers };
