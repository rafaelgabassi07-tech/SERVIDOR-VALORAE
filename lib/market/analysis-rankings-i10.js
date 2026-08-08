import { providerFetch } from '../http/provider-transport.js';

export const INVESTIDOR10_ANALYSIS_RANKINGS_VERSION = '21.12.404-analysis-rankings-semantic-v1';

const CACHE_TTL_MS = Number(process.env.VALORAE_I10_ANALYSIS_RANKINGS_TTL_MS || 5 * 60 * 1000);
const CACHE_STALE_MS = Number(process.env.VALORAE_I10_ANALYSIS_RANKINGS_STALE_MS || 24 * 60 * 60 * 1000);
const DEFAULT_LIMIT = Number(process.env.VALORAE_I10_ANALYSIS_RANKINGS_LIMIT || 40);
const cache = new Map();
const inflight = new Map();

const DEFINITIONS = Object.freeze({
  STOCK_MARKET_CAP: Object.freeze({
    id: 'STOCK_MARKET_CAP', assetType: 'ACAO', title: 'Maiores empresas',
    subtitle: 'Ações com maior valor de mercado na B3.',
    url: 'https://investidor10.com.br/acoes/rankings/maiores-valor-de-mercado/',
    pageNeedles: ['maior valor de mercado', 'maiores valor de mercado'],
    primaryKey: 'marketCap', primaryLabel: 'Valor de mercado', primaryAliases: ['valor de mercado'],
    displayMetrics: ['marketCap', 'price', 'dividendYield', 'pvp', 'netMargin', 'variation12m'],
  }),
  STOCK_DIVIDEND_YIELD: Object.freeze({
    id: 'STOCK_DIVIDEND_YIELD', assetType: 'ACAO', title: 'Maiores Dividend Yields',
    subtitle: 'Ações ordenadas pelo Dividend Yield informado na fonte.',
    url: 'https://investidor10.com.br/acoes/rankings/maiores-dividend-yield/',
    pageNeedles: ['maior dy', 'maiores dividend yield'],
    primaryKey: 'dividendYield', primaryLabel: 'Dividend Yield', primaryAliases: ['dividend yield', 'dy'],
    displayMetrics: ['dividendYield', 'dividendYield5y', 'price', 'pvp', 'marketCap', 'variation12m'],
  }),
  STOCK_NET_MARGIN: Object.freeze({
    id: 'STOCK_NET_MARGIN', assetType: 'ACAO', title: 'Maiores margens líquidas',
    subtitle: 'Empresas com maior margem líquida reportada.',
    url: 'https://investidor10.com.br/acoes/rankings/maiores-margens-liquidas/',
    pageNeedles: ['maiores margens liquidas', 'maior margem liquida'],
    primaryKey: 'netMargin', primaryLabel: 'Margem líquida', primaryAliases: ['margem liquida'],
    displayMetrics: ['netMargin', 'price', 'dividendYield', 'pvp', 'marketCap', 'roe'],
  }),
  FII_NET_WORTH: Object.freeze({
    id: 'FII_NET_WORTH', assetType: 'FII', title: 'Maiores patrimônios',
    subtitle: 'FIIs com maior patrimônio líquido.',
    url: 'https://investidor10.com.br/fiis/rankings/maior-valor-patrimonial/',
    pageNeedles: ['maior valor patrimonial', 'maiores valor patrimonial', 'maior patrimonio'],
    primaryKey: 'netWorth', primaryLabel: 'Patrimônio líquido', primaryAliases: ['patrimonio liquido', 'valor patrimonial'],
    displayMetrics: ['netWorth', 'pvp', 'dividendYield', 'dailyLiquidity', 'variation12m', 'segment'],
  }),
  FII_DIVIDEND_YIELD: Object.freeze({
    id: 'FII_DIVIDEND_YIELD', assetType: 'FII', title: 'Maiores Dividend Yields',
    subtitle: 'FIIs ordenados pelo Dividend Yield informado na fonte.',
    url: 'https://investidor10.com.br/fiis/rankings/maior-dividend-yield/',
    pageNeedles: ['maior dividend yield', 'maiores dividend yield'],
    primaryKey: 'dividendYield', primaryLabel: 'Dividend Yield', primaryAliases: ['dividend yield', 'dy'],
    displayMetrics: ['dividendYield', 'dividendYield5y', 'pvp', 'netWorth', 'dailyLiquidity', 'variation12m'],
  }),
  FII_MOST_SEARCHED: Object.freeze({
    id: 'FII_MOST_SEARCHED', assetType: 'FII', title: 'Mais buscados',
    subtitle: 'FIIs mais acessados na fonte, preservando a ordem publicada.',
    url: 'https://investidor10.com.br/fiis/rankings/mais-buscados/',
    pageNeedles: ['fiis mais buscados', 'mais buscados'],
    primaryKey: 'rank', primaryLabel: 'Popularidade', primaryAliases: [],
    displayMetrics: ['rank', 'netWorth', 'pvp', 'dividendYield', 'dailyLiquidity', 'variation12m'],
  }),
  FII_LIQUIDITY: Object.freeze({
    id: 'FII_LIQUIDITY', assetType: 'FII', title: 'Maior liquidez',
    subtitle: 'FIIs com maior liquidez diária.',
    url: 'https://investidor10.com.br/fiis/rankings/maior-liquidez/',
    pageNeedles: ['maior liquidez', 'maiores liquidez'],
    primaryKey: 'dailyLiquidity', primaryLabel: 'Liquidez diária', primaryAliases: ['liquidez diaria', 'liquidez'],
    displayMetrics: ['dailyLiquidity', 'netWorth', 'pvp', 'dividendYield', 'variation12m', 'segment'],
  }),
  FII_PVP_HIGH: Object.freeze({
    id: 'FII_PVP_HIGH', assetType: 'FII', title: 'Maior P/VP',
    subtitle: 'FIIs negociados com os maiores múltiplos P/VP.',
    url: 'https://investidor10.com.br/fiis/rankings/maior-pvp/',
    pageNeedles: ['maiores p/vp', 'maior p/vp'],
    primaryKey: 'pvp', primaryLabel: 'P/VP', primaryAliases: ['p/vp', 'p vp'],
    displayMetrics: ['pvp', 'netWorth', 'dividendYield', 'dailyLiquidity', 'variation12m', 'segment'],
  }),
  FII_PVP_LOW: Object.freeze({
    id: 'FII_PVP_LOW', assetType: 'FII', title: 'Menor P/VP',
    subtitle: 'FIIs negociados com os menores múltiplos P/VP.',
    url: 'https://investidor10.com.br/fiis/rankings/menor-pvp/',
    pageNeedles: ['menores p/vp', 'menor p/vp'],
    primaryKey: 'pvp', primaryLabel: 'P/VP', primaryAliases: ['p/vp', 'p vp'],
    displayMetrics: ['pvp', 'netWorth', 'dividendYield', 'dailyLiquidity', 'variation12m', 'segment'],
  }),
  FII_12M_GAIN: Object.freeze({
    id: 'FII_12M_GAIN', assetType: 'FII', title: 'Maiores altas em 12 meses',
    subtitle: 'FIIs com maior valorização de cotação em 12 meses.',
    url: 'https://investidor10.com.br/fiis/rankings/maior-valorizacao/',
    pageNeedles: ['maiores altas em 12 meses', 'maior alta em 12 meses'],
    primaryKey: 'variation12m', primaryLabel: 'Variação 12M', primaryAliases: ['variacao 12m', 'variacao 12 meses'],
    displayMetrics: ['variation12m', 'netWorth', 'pvp', 'dividendYield', 'dailyLiquidity', 'segment'],
  }),
});

const FIELD_ALIASES = Object.freeze({
  asset: ['ativos', 'ativo', 'ticker', 'codigo'],
  marketCap: ['valor de mercado', 'market cap', 'capitalizacao'],
  dividendYield: ['dividend yield', 'dy'],
  dividendYield5y: ['dy medio 5 anos', 'dy medio', 'dividend yield medio 5 anos'],
  netMargin: ['margem liquida'],
  netWorth: ['patrimonio liquido', 'valor patrimonial'],
  pvp: ['p/vp', 'p vp'],
  dailyLiquidity: ['liquidez diaria', 'liquidez'],
  variation12m: ['variacao 12m', 'variacao 12 meses'],
  variation24m: ['variacao 24m', 'variacao 24 meses'],
  variation5y: ['variacao 5 anos', 'variacao 5a'],
  price: ['preco atual', 'preco', 'cotacao'],
  score: ['pontuacao buy and hold', 'pontuacao'],
  pl: ['p/l', 'p l'],
  roe: ['roe'],
  fundType: ['tipo de fundo', 'tipo fundo'],
  sector: ['setor'],
  subSector: ['subsetor', 'sub setor'],
  segment: ['segmento'],
});

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/[\n\r\t]+/g, ' ')
    .replace(/[^a-z0-9/%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalTicker(raw = '') {
  const match = String(raw || '').toUpperCase().match(/\b(?:[A-Z]{4}\d{1,2}F?|[A-Z0-9]{3,6}\d{1,2})\b/);
  return match?.[0] || '';
}

function tickerFromHref(raw = '') {
  const match = String(raw || '').match(/\/(?:acoes|fiis|fiagros|etfs|bdrs)\/([a-z0-9]{5,8}f?)\/?/i);
  return canonicalTicker(match?.[1] || '');
}

function absoluteUrl(raw = '') {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://investidor10.com.br${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeDisplay(raw = '') {
  const value = String(raw ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  return value === '—' || value === '-' ? '' : value;
}

function parsePtNumber(raw = '') {
  const display = normalizeDisplay(raw);
  if (!display) return null;
  let text = display.replace(/R\$|US\$|%/gi, '').replace(/\s+/g, '').trim();
  const unitMatch = text.match(/([KMBT])$/i);
  const unit = unitMatch?.[1]?.toUpperCase();
  if (unit) text = text.slice(0, -1);
  const negative = text.startsWith('-');
  text = text.replace(/^[+-]/, '');
  if (text.includes(',') && text.includes('.')) text = text.replace(/\./g, '').replace(',', '.');
  else if (text.includes(',')) text = text.replace(',', '.');
  const number = Number(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(number)) return null;
  const multiplier = unit === 'K' ? 1e3 : unit === 'M' ? 1e6 : unit === 'B' ? 1e9 : unit === 'T' ? 1e12 : 1;
  return (negative ? -number : number) * multiplier;
}

function headerField(header = '') {
  const normalized = normalizeText(header);
  const entries = Object.entries(FIELD_ALIASES);
  for (const [key, aliases] of entries) {
    const alias = aliases.find(item => normalized === normalizeText(item));
    if (alias) return key;
  }
  // Cabeçalhos responsivos podem juntar a quebra de linha (ex.: "DY Médio 5 anos").
  for (const [key, aliases] of entries) {
    const alias = aliases.find(item => normalized.includes(normalizeText(item)));
    if (alias) return key;
  }
  return '';
}

function decodeHtml(value = '') {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value = '') {
  return normalizeDisplay(decodeHtml(String(value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')));
}

function extractBlocks(html = '', tag = 'table') {
  const source = String(html || '');
  const re = new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}>`, 'gi');
  return source.match(re) || [];
}

function extractRows(tableHtml = '') {
  return String(tableHtml || '').match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
}

function extractCells(rowHtml = '') {
  const cells = [];
  const re = /<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = re.exec(String(rowHtml || '')))) {
    cells.push({ tag: match[1].toLowerCase(), attrs: match[2] || '', html: match[3] || '', text: stripTags(match[3] || '') });
  }
  return cells;
}

function tableHeaderMap(tableHtml = '') {
  const rows = extractRows(tableHtml);
  let cells = [];
  for (const row of rows) {
    const candidate = extractCells(row);
    if (candidate.some(cell => cell.tag === 'th')) { cells = candidate; break; }
  }
  if (!cells.length && rows.length) cells = extractCells(rows[0]);
  const headers = cells.map(cell => normalizeDisplay(cell.text));
  const fields = headers.map(headerField);
  const map = {};
  fields.forEach((field, index) => { if (field && map[field] === undefined) map[field] = index; });
  return { headers, fields, map, headerRowIndex: rows.findIndex(row => extractCells(row).some(cell => cell.tag === 'th')) };
}

function chooseSemanticTable(html = '', definition) {
  const candidates = extractBlocks(html, 'table').map(table => {
    const meta = tableHeaderMap(table);
    const headerText = normalizeText(meta.headers.join(' | '));
    const hasAsset = meta.map.asset !== undefined || headerText.includes('ativos');
    const hasPrimary = definition.primaryKey === 'rank'
      ? hasAsset
      : meta.map[definition.primaryKey] !== undefined || definition.primaryAliases.some(alias => headerText.includes(normalizeText(alias)));
    const metricCount = Object.keys(meta.map).length;
    const rowCount = extractRows(table).length - 1;
    return { table, meta, score: (hasAsset ? 50 : 0) + (hasPrimary ? 50 : 0) + metricCount * 2 + Math.min(Math.max(rowCount, 0), 40), hasAsset, hasPrimary };
  }).filter(item => item.hasAsset && item.hasPrimary);
  return candidates.sort((a, b) => b.score - a.score)[0] || null;
}

function extractHref(cellHtml = '', rowHtml = '') {
  const preferred = /<a\b[^>]*href=["']([^"']*\/(?:acoes|fiis|fiagros|etfs|bdrs)\/[a-z0-9]{5,8}f?\/?[^"']*)["']/i.exec(String(cellHtml || ''));
  const fallback = preferred || /<a\b[^>]*href=["']([^"']*\/(?:acoes|fiis|fiagros|etfs|bdrs)\/[a-z0-9]{5,8}f?\/?[^"']*)["']/i.exec(String(rowHtml || ''));
  return fallback?.[1] || '';
}

function extractLogo(cellHtml = '') {
  const match = /<img\b[^>]*(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i.exec(String(cellHtml || ''));
  return absoluteUrl(match?.[1] || '');
}

function rowCellDisplay(cells, index) {
  if (index === undefined || index < 0 || index >= cells.length) return '';
  return normalizeDisplay(cells[index]?.text || '');
}

function parseSemanticRankingHtml(html = '', rankingId = '', limit = DEFAULT_LIMIT) {
  const definition = DEFINITIONS[String(rankingId || '').toUpperCase()];
  if (!definition) throw new Error(`Ranking não suportado: ${rankingId}`);
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(String(html || ''));
  const h1Match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(String(html || ''));
  const pageTitle = normalizeText(`${stripTags(titleMatch?.[1] || '')} ${stripTags(h1Match?.[1] || '')}`);
  const identityOk = definition.pageNeedles.some(needle => pageTitle.includes(normalizeText(needle)));
  const selected = chooseSemanticTable(html, definition);
  if (!selected) {
    return { identityOk, items: [], structure: { headers: [], fields: [], reason: 'semantic-table-not-found' } };
  }

  const { table, meta } = selected;
  const allRows = extractRows(table);
  const dataRows = allRows.filter((row, index) => {
    const cells = extractCells(row);
    if (!cells.length) return false;
    if (cells.some(cell => cell.tag === 'th')) return false;
    return index !== meta.headerRowIndex;
  });
  const items = [];
  const seen = new Set();

  for (const row of dataRows) {
    const cells = extractCells(row);
    if (!cells.length) continue;
    const assetIndex = meta.map.asset ?? 0;
    const assetCell = cells[assetIndex] || cells[0];
    const href = extractHref(assetCell?.html || '', row);
    const ticker = tickerFromHref(href) || canonicalTicker(assetCell?.text || '') || canonicalTicker(stripTags(row));
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    const nameText = normalizeDisplay(assetCell?.text || '').replace(new RegExp(`\\b${ticker}\\b`, 'i'), '').trim();

    const displays = {};
    for (const [field, index] of Object.entries(meta.map)) {
      if (field === 'asset') continue;
      displays[field] = rowCellDisplay(cells, index);
    }
    const values = {};
    for (const [field, display] of Object.entries(displays)) {
      if (!['fundType', 'sector', 'subSector', 'segment'].includes(field)) values[field] = parsePtNumber(display);
    }

    const rank = items.length + 1;
    const primaryDisplay = definition.primaryKey === 'rank' ? `#${rank}` : (displays[definition.primaryKey] || '');
    const primaryValue = definition.primaryKey === 'rank' ? rank : values[definition.primaryKey];
    items.push({
      rank,
      ticker,
      symbol: ticker,
      name: nameText || undefined,
      assetType: definition.assetType,
      primaryMetricKey: definition.primaryKey,
      primaryMetricLabel: definition.primaryLabel,
      primaryMetricValue: primaryValue ?? undefined,
      primaryMetricDisplay: primaryDisplay || undefined,
      price: values.price ?? undefined,
      priceDisplay: displays.price || undefined,
      marketCap: values.marketCap ?? undefined,
      marketCapDisplay: displays.marketCap || undefined,
      netMargin: values.netMargin ?? undefined,
      netMarginDisplay: displays.netMargin || undefined,
      netWorth: values.netWorth ?? undefined,
      netWorthDisplay: displays.netWorth || undefined,
      pvp: values.pvp ?? undefined,
      pvpDisplay: displays.pvp || undefined,
      dividendYield: values.dividendYield ?? undefined,
      dividendYieldDisplay: displays.dividendYield || undefined,
      dividendYield5y: values.dividendYield5y ?? undefined,
      dividendYield5yDisplay: displays.dividendYield5y || undefined,
      dailyLiquidity: values.dailyLiquidity ?? undefined,
      dailyLiquidityDisplay: displays.dailyLiquidity || undefined,
      variation12m: values.variation12m ?? undefined,
      variation12mDisplay: displays.variation12m || undefined,
      variation24m: values.variation24m ?? undefined,
      variation24mDisplay: displays.variation24m || undefined,
      variation5y: values.variation5y ?? undefined,
      variation5yDisplay: displays.variation5y || undefined,
      pl: values.pl ?? undefined,
      plDisplay: displays.pl || undefined,
      roe: values.roe ?? undefined,
      roeDisplay: displays.roe || undefined,
      fundType: displays.fundType || undefined,
      sector: displays.sector || undefined,
      subSector: displays.subSector || undefined,
      segment: displays.segment || undefined,
      logoUrl: extractLogo(assetCell?.html || '') || undefined,
      source: 'Investidor10',
      url: absoluteUrl(href) || definition.url,
    });
    if (items.length >= Math.max(1, Number(limit) || DEFAULT_LIMIT)) break;
  }

  const primaryCompleteness = definition.primaryKey === 'rank'
    ? items.length
    : items.filter(item => item.primaryMetricValue !== undefined && item.primaryMetricValue !== null).length;
  return {
    identityOk,
    items,
    structure: {
      headers: meta.headers,
      fields: meta.fields.filter(Boolean),
      primaryCompleteness,
      rowCount: items.length,
    },
  };
}

function catalogEntry(definition) {
  return {
    id: definition.id,
    assetType: definition.assetType,
    title: definition.title,
    subtitle: definition.subtitle,
    primaryMetricKey: definition.primaryKey,
    primaryMetricLabel: definition.primaryLabel,
    displayMetrics: definition.displayMetrics,
  };
}

export function getInvestidor10AnalysisRankingCatalog() {
  return {
    status: 'OK',
    version: INVESTIDOR10_ANALYSIS_RANKINGS_VERSION,
    source: 'Investidor10',
    updatedAt: new Date().toISOString(),
    items: Object.values(DEFINITIONS).map(catalogEntry),
  };
}

async function fetchHtml(url, timeoutMs) {
  const response = await providerFetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.5',
      'user-agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/132 Mobile Safari/537.36 VALORAE/analysis-ranking',
    },
    provider: 'investidor10',
    totalTimeoutMs: timeoutMs,
  });
  if (!response?.ok) throw new Error(`Investidor10 respondeu HTTP ${response?.status || 0}`);
  return response.text();
}

function cacheValue(key, allowStale = false) {
  const entry = cache.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.at;
  const limit = allowStale ? CACHE_STALE_MS : CACHE_TTL_MS;
  return age <= limit ? entry.value : null;
}

export async function fetchInvestidor10AnalysisRanking(options = {}) {
  const rankingId = String(options.rankingId || options.ranking || options.id || '').toUpperCase();
  const definition = DEFINITIONS[rankingId];
  if (!definition) {
    return {
      ok: false, status: 'ERROR', code: 'UNSUPPORTED_RANKING',
      error: `Ranking não suportado: ${rankingId || '(vazio)'}`,
      catalog: Object.values(DEFINITIONS).map(catalogEntry),
    };
  }
  const limit = Math.max(1, Math.min(60, Number(options.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT));
  const timeoutMs = Math.max(1200, Math.min(20000, Number(options.timeoutMs || 7000) || 7000));
  const bypassCache = Boolean(options.bypassCache || options.refresh || options.nocache);
  const key = `${rankingId}|${limit}`;
  if (!bypassCache) {
    const fresh = cacheValue(key, false);
    if (fresh) return { ...fresh, cacheState: 'HIT' };
  }
  if (inflight.has(key) && !bypassCache) return inflight.get(key);

  const task = (async () => {
    const stale = cacheValue(key, true);
    try {
      const html = await fetchHtml(definition.url, timeoutMs);
      const parsed = parseSemanticRankingHtml(html, rankingId, limit);
      const enoughRows = parsed.items.length >= Math.min(3, limit);
      const primaryEnough = definition.primaryKey === 'rank'
        ? parsed.items.length >= Math.min(3, limit)
        : Number(parsed.structure.primaryCompleteness || 0) >= Math.min(3, limit);
      if (!parsed.identityOk || !enoughRows || !primaryEnough) {
        const reason = !parsed.identityOk ? 'page-identity-mismatch' : !enoughRows ? 'insufficient-rows' : 'primary-metric-incomplete';
        if (stale?.items?.length) {
          return {
            ...stale,
            status: 'STALE',
            partial: true,
            degraded: true,
            cacheState: 'STALE',
            warning: `Estrutura externa alterada ou incompleta (${reason}); último snapshot válido preservado.`,
            liveStructure: parsed.structure,
          };
        }
        return {
          ok: false, status: 'PARTIAL', partial: true, degraded: true,
          ranking: catalogEntry(definition), items: parsed.items,
          source: 'Investidor10', sourceUrl: definition.url,
          updatedAt: new Date().toISOString(), cacheState: 'MISS',
          warning: `Ranking recebido com cobertura insuficiente (${reason}).`,
          structure: parsed.structure,
        };
      }
      const value = {
        ok: true, status: 'OK', partial: false, degraded: false,
        version: INVESTIDOR10_ANALYSIS_RANKINGS_VERSION,
        ranking: catalogEntry(definition),
        items: parsed.items,
        source: 'Investidor10', sourceUrl: definition.url,
        updatedAt: new Date().toISOString(), cacheState: 'MISS',
        structure: parsed.structure,
      };
      cache.set(key, { at: Date.now(), value });
      if (cache.size > 64) cache.delete(cache.keys().next().value);
      return value;
    } catch (error) {
      if (stale?.items?.length) {
        return {
          ...stale,
          status: 'STALE', partial: true, degraded: true, cacheState: 'STALE',
          warning: `Fonte indisponível; último snapshot válido preservado. ${error?.message || ''}`.trim(),
        };
      }
      return {
        ok: false, status: 'ERROR', partial: true, degraded: true,
        ranking: catalogEntry(definition), items: [],
        source: 'Investidor10', sourceUrl: definition.url,
        updatedAt: new Date().toISOString(), cacheState: 'MISS',
        error: error?.message || 'Falha ao carregar ranking.',
      };
    }
  })().finally(() => inflight.delete(key));

  if (!bypassCache) inflight.set(key, task);
  return task;
}

export const _test = {
  normalizeText,
  headerField,
  parsePtNumber,
  parseSemanticRankingHtml,
  chooseSemanticTable,
  definitions: DEFINITIONS,
};
