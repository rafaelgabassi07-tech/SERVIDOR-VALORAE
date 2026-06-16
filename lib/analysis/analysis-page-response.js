import { RELEASE } from '../core/release.js';

const CONTRACT_VERSION = '26.analysis.v2';

const STOCK_INDICATORS = [
  { id: 'pl', label: 'P/L', group: 'Valuation', aliases: ['pl', 'p_l', 'pL', 'P/L'] },
  { id: 'psr', label: 'P/Receita (PSR)', group: 'Valuation', aliases: ['psr', 'pReceitaPsr', 'pReceita', 'P/Receita (PSR)'] },
  { id: 'pvp', label: 'P/VP', group: 'Valuation', aliases: ['pvp', 'p_vp', 'pVP', 'P/VP'] },
  { id: 'dividendYield', label: 'Dividend Yield', group: 'Dividendos', aliases: ['dividendYield', 'dy', 'yield12m', 'Dividend Yield', 'DY'] },
  { id: 'payout', label: 'Payout', group: 'Dividendos', aliases: ['payout', 'Payout'] },
  { id: 'margemLiquida', label: 'Margem Líquida', group: 'Margens', aliases: ['margemLiquida', 'Margem Líquida'] },
  { id: 'margemBruta', label: 'Margem Bruta', group: 'Margens', aliases: ['margemBruta', 'Margem Bruta'] },
  { id: 'margemEbit', label: 'Margem Ebit', group: 'Margens', aliases: ['margemEbit', 'Margem Ebit'] },
  { id: 'margemEbitda', label: 'Margem Ebitda', group: 'Margens', aliases: ['margemEbitda', 'Margem Ebitda'] },
  { id: 'evEbitda', label: 'EV/Ebitda', group: 'Múltiplos', aliases: ['evEbitda', 'EV/Ebitda'] },
  { id: 'evEbit', label: 'EV/Ebit', group: 'Múltiplos', aliases: ['evEbit', 'EV/Ebit'] },
  { id: 'pEbitda', label: 'P/Ebitda', group: 'Múltiplos', aliases: ['pEbitda', 'P/Ebitda'] },
  { id: 'pEbit', label: 'P/Ebit', group: 'Múltiplos', aliases: ['pEbit', 'P/Ebit'] },
  { id: 'pAtivo', label: 'P/Ativo', group: 'Balanço', aliases: ['pAtivo', 'P/Ativo'] },
  { id: 'pCapGiro', label: 'P/Cap.Giro', group: 'Balanço', aliases: ['pCapGiro', 'P/Cap.Giro', 'P/Cap Giro'] },
  { id: 'pAtivoCircLiq', label: 'P/Ativo Circ. Liq.', group: 'Balanço', aliases: ['pAtivoCircLiq', 'P/Ativo Circ. Liq.', 'P/Ativo Circ Liq'] },
  { id: 'vpa', label: 'VPA', group: 'Por ação', aliases: ['vpa', 'VPA'] },
  { id: 'lpa', label: 'LPA', group: 'Por ação', aliases: ['lpa', 'LPA'] },
  { id: 'giroAtivos', label: 'Giro Ativos', group: 'Eficiência', aliases: ['giroAtivos', 'Giro Ativos'] },
  { id: 'roe', label: 'ROE', group: 'Rentabilidade', aliases: ['roe', 'ROE'] },
  { id: 'roic', label: 'ROIC', group: 'Rentabilidade', aliases: ['roic', 'ROIC'] },
  { id: 'roa', label: 'ROA', group: 'Rentabilidade', aliases: ['roa', 'ROA'] },
  { id: 'dividaLiquidaPatrimonio', label: 'Dívida Líquida / Patrimônio', group: 'Dívida', aliases: ['dividaLiquidaPatrimonio', 'Dívida Líquida / Patrimônio'] },
  { id: 'dividaLiquidaEbitda', label: 'Dívida Líquida / Ebitda', group: 'Dívida', aliases: ['dividaLiquidaEbitda', 'Dívida Líquida / Ebitda'] },
  { id: 'dividaLiquidaEbit', label: 'Dívida Líquida / Ebit', group: 'Dívida', aliases: ['dividaLiquidaEbit', 'Dívida Líquida / Ebit'] },
  { id: 'dividaBrutaPatrimonio', label: 'Dívida Bruta / Patrimônio', group: 'Dívida', aliases: ['dividaBrutaPatrimonio', 'Dívida Bruta / Patrimônio'] },
  { id: 'patrimonioAtivos', label: 'Patrimônio / Ativos', group: 'Estrutura', aliases: ['patrimonioAtivos', 'Patrimônio / Ativos'] },
  { id: 'passivosAtivos', label: 'Passivos / Ativos', group: 'Estrutura', aliases: ['passivosAtivos', 'Passivos / Ativos'] },
  { id: 'liquidezCorrente', label: 'Liquidez Corrente', group: 'Liquidez', aliases: ['liquidezCorrente', 'Liquidez Corrente'] },
  { id: 'cagrReceitas5Anos', label: 'CAGR Receitas 5 anos', group: 'Crescimento', aliases: ['cagrReceitas5Anos', 'CAGR Receitas 5 anos'] },
  { id: 'cagrLucros5Anos', label: 'CAGR Lucros 5 anos', group: 'Crescimento', aliases: ['cagrLucros5Anos', 'CAGR Lucros 5 anos'] }
];

const PERCENT_IDS = new Set([
  'dividendYield', 'payout', 'margemLiquida', 'margemBruta', 'margemEbit', 'margemEbitda',
  'roe', 'roic', 'roa', 'patrimonioAtivos', 'passivosAtivos', 'cagrReceitas5Anos', 'cagrLucros5Anos'
]);

const MONEY_IDS = new Set(['vpa', 'lpa']);

function cleanText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'object') {
    return cleanText(value.display || value.fmt || value.value || value.raw || value.text || value.label || '');
  }
  return String(value).trim();
}

function norm(value) {
  return cleanText(value)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\/+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function numberFrom(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (value && typeof value === 'object') return numberFrom(value.raw ?? value.value ?? value.fmt ?? value.display);
  const raw = cleanText(value).replace(/R\$/g, '').replace(/%/g, '').trim();
  if (!raw || raw === '--' || raw === '-') return undefined;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

function brl(value) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function decimalDisplay(value, digits = 2) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

function percentDisplay(value) {
  const n = numberFrom(value);
  if (n === undefined) return '';
  const adjusted = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(adjusted)}%`;
}

function rawField(payload, aliases = []) {
  for (const key of aliases) {
    const direct = payload?.[key];
    if (direct !== undefined && direct !== null && cleanText(direct) !== '' && cleanText(direct) !== '0') return direct;
    const indicators = payload?.indicators?.[key] ?? payload?.fundamentals?.[key] ?? payload?.fundamentos?.[key] ?? payload?.indicadoresAvancados?.[key] ?? payload?.results?.[key] ?? payload?.results?.indicadores?.[key] ?? payload?.results?.indicadoresFundamentalistas?.semComparativos?.[key];
    if (indicators !== undefined && indicators !== null && cleanText(indicators) !== '' && cleanText(indicators) !== '0') return indicators;
    const normalized = payload?.normalized?.[key] ?? payload?.appPayload?.metrics?.canonical?.[key] ?? payload?.appMobileSnapshot?.metrics?.[key];
    if (normalized !== undefined && normalized !== null && cleanText(normalized) !== '' && cleanText(normalized) !== '0') return normalized;
  }
  return undefined;
}

function indicatorCards(payload = {}) {
  const cards = [];
  const candidates = [
    payload?.assetChartBundle?.indicatorCards,
    payload?.assetChartsMobile?.indicatorCards,
    payload?.results?.assetChartBundle?.indicatorCards,
    payload?.results?.assetChartsMobile?.indicatorCards,
  ];
  for (const arr of candidates) if (Array.isArray(arr)) cards.push(...arr);
  return cards;
}

function displayFromCard(payload, spec) {
  const wanted = new Set([spec.label, ...(spec.aliases || [])].map(norm));
  for (const card of indicatorCards(payload)) {
    const label = cleanText(card?.label || card?.name || card?.key);
    if (!wanted.has(norm(label))) continue;
    const display = cleanText(card.display || card.valueDisplay || card.value);
    if (display && display !== '0') return { value: display, source: card.source || 'StatusInvest/Investidor10', raw: card.value };
  }
  return null;
}

function displayForSpec(payload, spec) {
  const fromCard = displayFromCard(payload, spec);
  if (fromCard?.value) return fromCard;
  const raw = rawField(payload, spec.aliases || [spec.id]);
  if (raw === undefined) return null;
  const display = MONEY_IDS.has(spec.id) ? brl(raw) : (PERCENT_IDS.has(spec.id) ? percentDisplay(raw) : decimalDisplay(raw));
  return display ? { value: display, source: 'StatusInvest/Investidor10', raw } : null;
}

function computeTwelveMonthVariation(payload = {}) {
  const explicit = rawField(payload, ['variacao12m', 'variation12m', 'change12m', 'valorizacao12m']);
  if (explicit !== undefined) return percentDisplay(explicit);
  const points = payload?.assetChartBundle?.priceHistory || payload?.assetChartsMobile?.priceHistory || payload?.results?.historicoPrecos || payload?.results?.priceHistory || [];
  if (!Array.isArray(points) || points.length < 2) return '';
  const clean = points.map(p => ({ date: p.date || p.timestamp || p.time || '', value: numberFrom(p.close ?? p.price ?? p.value) }))
    .filter(p => p.value !== undefined && p.value > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (clean.length < 2) return '';
  const first = clean[0].value;
  const last = clean[clean.length - 1].value;
  if (!(first > 0) || !(last > 0)) return '';
  return percentDisplay(((last / first) - 1) * 100);
}

function buildSummaryItems(payload = {}, assetType = '') {
  const isFii = String(assetType).toUpperCase() === 'FII';
  const price = brl(payload.currentPrice ?? payload.price ?? payload.precoAtual ?? payload.quote?.price ?? payload.quote?.currentPrice ?? payload.results?.precoAtual);
  const variation12m = computeTwelveMonthVariation(payload);
  const pl = displayForSpec(payload, STOCK_INDICATORS[0])?.value || '';
  const pvp = displayForSpec(payload, STOCK_INDICATORS[2])?.value || '';
  const dy = displayForSpec(payload, STOCK_INDICATORS[3])?.value || '';
  const rows = [
    { id: 'price', label: isFii ? 'Cotação da cota' : 'Cotação', value: price, group: 'Resumo', source: 'VALORAE Proxy' },
    { id: 'variation_12m', label: 'Variação 12M', value: variation12m, group: 'Resumo', source: 'Histórico real do Proxy' },
    ...(isFii ? [] : [{ id: 'pl', label: 'P/L', value: pl, group: 'Valuation', source: 'StatusInvest/Investidor10' }]),
    { id: 'pvp', label: 'P/VP', value: pvp, group: 'Valuation', source: 'StatusInvest/Investidor10' },
    { id: 'dy', label: isFii ? 'DY 12M' : 'DY', value: dy, group: 'Dividendos', source: 'StatusInvest/Investidor10' }
  ];
  return rows.filter(item => cleanText(item.value));
}

function buildFundamentalItems(payload = {}, assetType = '') {
  if (String(assetType).toUpperCase() === 'FII') {
    const fiiSpecs = STOCK_INDICATORS.filter(s => ['pvp', 'dividendYield'].includes(s.id));
    return fiiSpecs.map(spec => {
      const found = displayForSpec(payload, spec);
      return found?.value ? { id: spec.id, label: spec.label === 'Dividend Yield' ? 'DY 12M' : spec.label, value: found.value, group: spec.group, source: found.source } : null;
    }).filter(Boolean);
  }
  return STOCK_INDICATORS.map(spec => {
    const found = displayForSpec(payload, spec);
    return found?.value ? { id: spec.id, label: spec.label, value: found.value, group: spec.group, source: found.source } : null;
  }).filter(Boolean);
}


function dateLabel(value = '') {
  const raw = cleanText(value);
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[1]}/${br[2]}/${br[3]}`;
  return raw.slice(0, 10);
}

function moneyPerShare(value) {
  const n = numberFrom(value);
  if (n === undefined || n <= 0) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(n);
}

function dividendEvents(payload = {}) {
  const candidates = [
    payload?.dividends,
    payload?.proventos,
    payload?.results?.dividends,
    payload?.results?.proventos,
    payload?.assetChartBundle?.dividendEvents,
    payload?.assetChartsMobile?.dividendEvents,
    payload?.appMobileSnapshot?.assetChartBundle?.dividendEvents,
    payload?.results?.assetChartBundle?.dividendEvents,
    payload?.results?.assetChartsMobile?.dividendEvents
  ];
  const events = [];
  for (const arr of candidates) if (Array.isArray(arr)) events.push(...arr);
  const unique = new Map();
  for (const event of events) {
    const amount = numberFrom(event?.valuePerShare ?? event?.grossValuePerShare ?? event?.netValuePerShare ?? event?.amount ?? event?.value ?? event?.valor);
    const paymentDate = cleanText(event?.paymentDate || event?.payDate || event?.dataPagamento || event?.datePayment || event?.date || event?.referenceDate);
    const comDate = cleanText(event?.dateCom || event?.comDate || event?.dataCom || event?.eligibilityDate || event?.recordDate);
    const kind = cleanText(event?.dividendType || event?.kind || event?.type || event?.event || event?.status || 'Provento') || 'Provento';
    if (!(amount > 0) && !paymentDate && !comDate) continue;
    const key = [paymentDate, comDate, kind, amount || 0].join('|');
    if (!unique.has(key)) unique.set(key, { ...event, amount, paymentDate, comDate, kind });
  }
  return [...unique.values()].sort((a, b) => String(b.paymentDate || b.comDate || '').localeCompare(String(a.paymentDate || a.comDate || '')));
}

function buildDividendSummaryItems(payload = {}, assetType = '') {
  const events = dividendEvents(payload);
  if (!events.length) return [];
  const last = events.find(e => Date.parse(e.paymentDate || e.comDate || '') <= Date.now()) || events[0];
  const total12m = events
    .filter(e => {
      const t = Date.parse(e.paymentDate || e.comDate || '');
      return Number.isFinite(t) && t >= Date.now() - 366 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, e) => sum + (numberFrom(e.amount) || 0), 0);
  const dy = displayForSpec(payload, STOCK_INDICATORS[3])?.value || '';
  const rows = [
    { id: 'last_dividend', label: assetType === 'FII' ? 'Último rendimento' : 'Último provento', value: moneyPerShare(last?.amount), group: cleanText(last?.kind) || 'Provento', source: 'StatusInvest proventos' },
    { id: 'last_payment_date', label: 'Último pagamento', value: dateLabel(last?.paymentDate), group: cleanText(last?.kind) || 'Provento', source: 'StatusInvest proventos' },
    { id: 'dy_12m', label: assetType === 'FII' ? 'DY 12M' : 'DY', value: dy, group: 'Dividendos', source: 'StatusInvest/Investidor10' },
    { id: 'paid_12m_per_share', label: 'Pago 12M por cota/ação', value: total12m > 0 ? moneyPerShare(total12m) : '', group: `${events.length} evento(s)`, source: 'StatusInvest proventos' }
  ];
  return rows.filter(item => cleanText(item.value));
}

function buildDividendHistoryItems(payload = {}) {
  return dividendEvents(payload).slice(0, 24).map((event, index) => {
    const payment = dateLabel(event.paymentDate);
    const com = dateLabel(event.comDate);
    const kind = cleanText(event.kind || event.dividendType || event.type || 'Provento') || 'Provento';
    const amount = moneyPerShare(event.amount ?? event.valuePerShare ?? event.grossValuePerShare ?? event.value);
    return amount ? {
      id: `dividend_${index + 1}`,
      label: payment ? `Pagamento ${payment}` : kind,
      value: amount,
      group: [kind, com ? `Data com ${com}` : ''].filter(Boolean).join(' • '),
      source: cleanText(event.source || event.rawProvider || 'StatusInvest proventos')
    } : null;
  }).filter(Boolean);
}


function arrayFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return Object.entries(value).map(([label, raw]) => ({ label, value: raw, raw }));
  return [];
}

function objectFrom(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function pickArray(payload = {}, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], payload);
    const arr = arrayFrom(value);
    if (arr.length) return arr;
  }
  return [];
}

function pickObject(payload = {}, paths = []) {
  for (const path of paths) {
    const value = path.split('.').reduce((acc, key) => acc?.[key], payload);
    const obj = objectFrom(value);
    if (Object.keys(obj).length) return obj;
  }
  return {};
}

function finiteValue(value) {
  const n = numberFrom(value);
  return n !== undefined && Number.isFinite(n) ? n : undefined;
}

function compactDisplay(value) {
  const n = finiteValue(value);
  if (n === undefined) return cleanText(value);
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${decimalDisplay(n / 1_000_000_000, 2)} bi`;
  if (abs >= 1_000_000) return `${decimalDisplay(n / 1_000_000, 2)} mi`;
  if (abs >= 1_000) return `${decimalDisplay(n / 1_000, 2)} mil`;
  return decimalDisplay(n, 2);
}

function chartPoint(row = {}, valueKeys = ['value', 'close', 'price']) {
  const label = cleanText(row.label || row.period || row.year || row.date || row.timestamp || row.month || row.name);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  return { label: label.slice(0, 18), value, display: cleanText(row.display) || compactDisplay(value) };
}

function normalizePoints(rows = [], valueKeys = ['value', 'close', 'price'], limit = 18) {
  return arrayFrom(rows).map(row => chartPoint(row, valueKeys)).filter(Boolean).slice(-limit);
}

function numericLabelPoint(row = {}, labelKeys = ['label', 'period', 'year', 'date', 'month', 'name'], valueKeys = ['value', 'percent', 'percentage']) {
  const label = labelKeys.map(k => cleanText(row?.[k])).find(Boolean) || cleanText(row?.raw?.label || row?.raw?.name);
  let value;
  for (const key of valueKeys) {
    value = finiteValue(row?.[key]);
    if (value !== undefined) break;
  }
  if (!label || value === undefined) return null;
  return { label: label.slice(0, 18), value, display: cleanText(row.display) || compactDisplay(value) };
}

function normalizeDistributionPoints(source = {}, valueKeys = ['value', 'percentual', 'percentage', 'valuePercent', 'percent']) {
  const rows = [];
  if (Array.isArray(source)) {
    for (const row of source) rows.push(row);
  } else if (source && typeof source === 'object') {
    for (const [group, value] of Object.entries(source)) {
      if (Array.isArray(value)) {
        value.forEach(item => rows.push({ group, ...(item || {}) }));
      } else if (value && typeof value === 'object') {
        for (const [name, raw] of Object.entries(value)) rows.push({ label: name, name, value: raw });
      } else {
        rows.push({ label: group, name: group, value });
      }
    }
  }
  return rows.map(row => numericLabelPoint(row, ['label', 'name', 'nome', 'tipo', 'classe', 'group'], valueKeys)).filter(Boolean);
}

function analysisChart(id, title, chartType, points, source = 'VALORAE Proxy', options = {}) {
  const safePoints = normalizePoints(points, options.valueKeys || ['value', 'close', 'price'], options.limit || 18);
  if (safePoints.length < (options.minPoints || 1)) return null;
  return {
    id,
    title,
    chartType,
    source,
    unit: options.unit || '',
    series: [{ id: options.seriesId || 'value', label: options.seriesLabel || title, points: safePoints }]
  };
}

function dualSeriesChart(id, title, chartType, rows = [], source = 'VALORAE Proxy', left = {}, right = {}) {
  const normalized = arrayFrom(rows).slice(-14);
  const leftPoints = normalized.map(row => chartPoint(row, left.valueKeys || ['netRevenue', 'revenue', 'receita', 'value'])).filter(Boolean);
  const rightPoints = normalized.map(row => chartPoint(row, right.valueKeys || ['netProfit', 'profit', 'lucro', 'secondaryValue'])).filter(Boolean);
  const series = [];
  if (leftPoints.length) series.push({ id: left.id || 'primary', label: left.label || 'Receita', points: leftPoints });
  if (rightPoints.length) series.push({ id: right.id || 'secondary', label: right.label || 'Lucro', points: rightPoints });
  if (!series.length) return null;
  return { id, title, chartType, source, unit: left.unit || '', series };
}

function chartPreviewItems(charts = []) {
  return charts.map(chart => ({
    id: chart.id,
    label: chart.title,
    value: `${chart.series.reduce((sum, serie) => sum + (serie.points?.length || 0), 0)} ponto(s)`,
    group: chart.source || 'VALORAE Proxy',
    source: chart.source || 'VALORAE Proxy'
  }));
}

function tableItemsFromObject(obj = {}, source = 'VALORAE Proxy', limit = 24) {
  return Object.entries(objectFrom(obj)).map(([key, value]) => {
    const label = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
    const display = cleanText(value) || compactDisplay(value);
    return display ? { id: norm(label).replace(/\s+/g, '_'), label, value: display, group: 'Dados capturados', source } : null;
  }).filter(Boolean).slice(0, limit);
}

function buildHistoricalIndicatorItems(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const rows = [];
  for (const item of arrayFrom(bundle.payoutHistory)) {
    const label = cleanText(item.year || item.label || 'Payout');
    const value = cleanText(item.display) || percentDisplay(item.value);
    if (label && value) rows.push({ id: `payout_${label}`, label: `Payout ${label}`, value, group: 'Histórico', source: item.source || 'StatusInvest/Investidor10' });
  }
  for (const item of arrayFrom(bundle.dividendYieldHistory)) {
    const label = cleanText(item.year || item.label || item.date || 'DY');
    const value = cleanText(item.display) || percentDisplay(item.value);
    if (label && value) rows.push({ id: `dy_${label}`, label: `DY ${label}`, value, group: 'Histórico', source: item.source || 'StatusInvest/Investidor10' });
  }
  const explicit = pickArray(payload, ['historicalIndicators', 'historicoIndicadores', 'results.historicoIndicadores', 'results.historicalIndicators']);
  for (const item of explicit) {
    const label = cleanText(item.label || item.name || item.indicator || item.year || item.period);
    const value = cleanText(item.value || item.display || item.valor);
    if (label && value) rows.push({ id: `hist_${rows.length + 1}`, label, value, group: cleanText(item.period || item.year || item.group || 'Histórico'), source: item.source || 'StatusInvest/Investidor10' });
  }
  return rows.slice(0, 40);
}

function buildFinancialStatementItems(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const rows = [];
  for (const row of arrayFrom(bundle.revenueProfit)) {
    const label = cleanText(row.year || row.label || 'Período');
    const revenue = compactDisplay(row.netRevenue ?? row.revenue ?? row.receita);
    const profit = compactDisplay(row.netProfit ?? row.profit ?? row.lucro);
    if (label && revenue) rows.push({ id: `dre_revenue_${label}`, label: `Receita ${label}`, value: revenue, group: 'DRE', source: 'StatusInvest/Yahoo fundamentals' });
    if (label && profit) rows.push({ id: `dre_profit_${label}`, label: `Lucro ${label}`, value: profit, group: 'DRE', source: 'StatusInvest/Yahoo fundamentals' });
  }
  for (const row of arrayFrom(bundle.balanceSheet || bundle.equityEvolution)) {
    const label = cleanText(row.year || row.label || 'Período');
    const equity = compactDisplay(row.netWorth ?? row.equity ?? row.patrimonioLiquido);
    const assets = compactDisplay(row.totalAssets ?? row.ativos ?? row.assets);
    if (label && equity) rows.push({ id: `balance_equity_${label}`, label: `Patrimônio ${label}`, value: equity, group: 'Balanço', source: 'StatusInvest/Yahoo fundamentals' });
    if (label && assets) rows.push({ id: `balance_assets_${label}`, label: `Ativos ${label}`, value: assets, group: 'Balanço', source: 'StatusInvest/Yahoo fundamentals' });
  }
  const explicitStatements = pickObject(payload, ['statements', 'results.statements', 'demonstrativos', 'results.demonstrativos', 'financialSummary', 'results.financialSummary']);
  rows.push(...tableItemsFromObject(explicitStatements, 'StatusInvest/Yahoo fundamentals', 24));
  return rows.filter((item, index, arr) => arr.findIndex(x => x.id === item.id && x.value === item.value) === index).slice(0, 48);
}

function buildAssetCharts(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const assetType = cleanText(payload.assetClass || payload.type || payload.results?.assetClass || payload.results?.type).toUpperCase();
  const isFii = assetType === 'FII';
  const charts = [];

  const price = analysisChart('price_history', 'Cotação histórica', 'line', bundle.priceHistory || payload.historicoPrecos || payload.results?.historicoPrecos, 'Yahoo Finance / StatusInvest', { valueKeys: ['close', 'price', 'value'], minPoints: 2, limit: 24, unit: 'R$' });
  if (price) charts.push(price);

  const dividends = analysisChart(isFii ? 'fii_monthly_distribution' : 'dividend_history', isFii ? 'Rendimento mensal' : 'Histórico de proventos', 'bar', bundle.dividendMonthly || bundle.fiiDistribution12m || bundle.dividendYearly, 'StatusInvest/Investidor10 proventos', { valueKeys: ['amount', 'value', 'total', 'valuePerShare'], minPoints: 1, limit: 14, unit: 'R$' });
  if (dividends) charts.push(dividends);

  const dyHistory = analysisChart('dividend_yield_history', 'Dividend Yield histórico', 'line', bundle.dividendYieldHistory || bundle.fiiDividendYieldHistory || payload.dividendYieldHistory || payload.results?.dividendYieldHistory, 'StatusInvest/Investidor10 proventos', { valueKeys: ['yieldPercent', 'dividendYield', 'dy', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (dyHistory) charts.push(dyHistory);

  const revenueProfit = dualSeriesChart('revenue_profit', 'Receitas e Lucros', 'bar_line', bundle.revenueProfit || payload.statements?.revenueProfit || payload.results?.statements?.revenueProfit, 'StatusInvest/Yahoo fundamentals', { id: 'revenue', label: 'Receita', valueKeys: ['netRevenue', 'revenue', 'receita'] }, { id: 'profit', label: 'Lucro', valueKeys: ['netProfit', 'profit', 'lucro'] });
  if (revenueProfit) charts.push(revenueProfit);

  const profitQuote = dualSeriesChart('profit_vs_quote', 'Lucro x Cotação', 'line', bundle.profitVsQuote || payload.statements?.profitVsQuote || payload.results?.statements?.profitVsQuote, 'StatusInvest/Yahoo fundamentals', { id: 'quote', label: 'Cotação', valueKeys: ['value', 'price', 'quote'] }, { id: 'profit', label: 'Lucro', valueKeys: ['secondaryValue', 'profit', 'lucro'] });
  if (profitQuote) charts.push(profitQuote);

  const equity = analysisChart(isFii ? 'fii_patrimonial_value' : 'equity_evolution', isFii ? 'Valor patrimonial' : 'Evolução patrimonial', 'bar', bundle.equityEvolution || bundle.balanceSheet || bundle.fiiPatrimonialInfo || payload.statements?.balanceSheet || payload.results?.statements?.balanceSheet, 'StatusInvest/Yahoo fundamentals', { valueKeys: ['netWorth', 'equity', 'patrimonioLiquido', 'valorPatrimonial', 'patrimonialValue', 'value'], minPoints: 1, limit: 12, unit: isFii ? 'R$' : '' });
  if (equity) charts.push(equity);

  const payout = analysisChart('payout_history', 'Payout histórico', 'bar', bundle.payoutHistory || payload.payoutHistory || payload.results?.payoutHistory, 'StatusInvest/Investidor10', { valueKeys: ['payout', 'valuePercent', 'percent', 'percentage', 'value'], minPoints: 2, limit: 14, unit: '%' });
  if (payout) charts.push(payout);

  const assetDistributionPoints = normalizeDistributionPoints(bundle.fiiAssetDistribution || payload.fiiAssetDistribution || payload.results?.fiiAssetDistribution || payload.results?.distribuicaoAtivosFundo, ['percentual', 'valuePercent', 'percent', 'percentage', 'value']);
  const assetDistribution = analysisChart('fii_asset_distribution', 'Distribuição de ativos do fundo', 'bar', assetDistributionPoints, 'Investidor10/StatusInvest', { valueKeys: ['value'], minPoints: 1, limit: 12, unit: '%' });
  if (isFii && assetDistribution) charts.push(assetDistribution);

  return charts;
}

function firstClean(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return value;
  }
  return undefined;
}

function buildCompanyProfileItems(payload = {}, assetType = '') {
  const baseInfo = {
    ...(payload.results?.dadosEmpresa || {}),
    ...(payload.results?.informacoesEmpresa || {}),
    ...(payload.results?.informacoesFundo || {}),
    ...(payload.companyInfo || payload.empresa || payload.fundo || {})
  };
  const info = {
    ...baseInfo,
    setor: firstClean(payload.sector, payload.setor, baseInfo.setor, payload.results?.informacoesEmpresa?.setor, payload.results?.dadosEmpresa?.setor),
    subsetor: firstClean(payload.subSector, payload.subsetor, baseInfo.subsetor, payload.results?.informacoesEmpresa?.subsetor),
    segmento: firstClean(payload.segment, payload.fiiSegment, baseInfo.segmento, payload.results?.informacoesFundo?.segmento),
    descricao: firstClean(payload.assetDescription, payload.description, baseInfo.descricao, baseInfo.description, payload.profile?.description, payload.fundamentals?.profile?.description)
  };
  const rows = [];
  if (cleanText(info.descricao)) rows.push({ id: 'description', label: assetType === 'FII' ? 'Sobre o fundo' : 'Sobre a empresa', value: cleanText(info.descricao), group: 'Descrição', source: 'StatusInvest/Investidor10' });
  rows.push(...tableItemsFromObject(info, 'StatusInvest/Investidor10', 18).filter(item => !['descricao', 'description'].includes(item.id)));
  return rows.slice(0, 24);
}

function objectDistributionItems(obj = {}, group = 'Distribuição') {
  return Object.entries(objectFrom(obj)).map(([label, value]) => {
    const display = cleanText(value) || percentDisplay(value);
    return display ? { id: norm(label).replace(/\s+/g, '_'), label: cleanText(label), value: display, group, source: 'Investidor10/StatusInvest' } : null;
  }).filter(Boolean);
}

function buildRevenueBreakdown(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const business = pickObject(payload, ['results.empresa.negociosReceita', 'empresa.negociosReceita', 'negociosReceita', 'businessRevenue', 'results.negociosReceita']) || {};
  const regions = pickObject(payload, ['results.empresa.regioesReceita', 'empresa.regioesReceita', 'regioesReceita', 'regionRevenue', 'results.regioesReceita']) || {};
  const bundleBusiness = objectFrom(bundle.revenueByBusiness);
  const bundleRegions = objectFrom(bundle.revenueByRegion);
  const items = [
    ...objectDistributionItems({ ...bundleBusiness, ...business }, 'Negócios que geram receita'),
    ...objectDistributionItems({ ...bundleRegions, ...regions }, 'Regiões onde gera receita')
  ];
  const charts = [];
  const businessItems = items.filter(i => i.group === 'Negócios que geram receita').map(i => ({ label: i.label, value: finiteValue(i.value) ?? finiteValue(i.value.replace('%', '')) }));
  const regionItems = items.filter(i => i.group === 'Regiões onde gera receita').map(i => ({ label: i.label, value: finiteValue(i.value) ?? finiteValue(i.value.replace('%', '')) }));
  const businessChart = analysisChart('revenue_by_business', 'Negócios que geram receita', 'bar', businessItems, 'Investidor10/StatusInvest', { minPoints: 1, unit: '%' });
  const regionChart = analysisChart('revenue_by_region', 'Regiões onde geram receitas', 'bar', regionItems, 'Investidor10/StatusInvest', { minPoints: 1, unit: '%' });
  if (businessChart) charts.push(businessChart);
  if (regionChart) charts.push(regionChart);
  return { items, charts };
}

function buildComparisonItemsAndCharts(payload = {}) {
  const bundle = payload.assetChartBundle || payload.assetChartsMobile || payload.results?.assetChartBundle || payload.results?.assetChartsMobile || {};
  const rows = [];
  const charts = [];
  for (const serie of arrayFrom(bundle.indexComparison || payload.indexComparison || payload.results?.indexComparison)) {
    const name = cleanText(serie.name || serie.label || 'Comparador');
    const points = normalizePoints(serie.points || serie.values || [], ['value', 'return', 'valuePercent'], 18);
    if (name && points.length) {
      rows.push({ id: `comparison_${norm(name).replace(/\s+/g, '_')}`, label: name, value: `${points.length} ponto(s)`, group: 'Comparador com índices', source: serie.source || 'VALORAE Proxy' });
      charts.push({ id: `comparison_${norm(name).replace(/\s+/g, '_')}`, title: `Comparador: ${name}`, chartType: 'line', source: serie.source || 'VALORAE Proxy', unit: '%', series: [{ id: 'return', label: name, points }] });
    }
  }
  for (const item of arrayFrom(payload.peers || payload.results?.peers || payload.comparadorAcoes || payload.results?.comparadorAcoes)) {
    const label = cleanText(item.ticker || item.symbol || item.name || item.label);
    const value = cleanText(item.value || item.display || item.price || item.pvp || item.pl);
    if (label && value) rows.push({ id: `peer_${label}`, label, value, group: 'Comparador de ações/FIIs', source: item.source || 'StatusInvest/Investidor10' });
  }
  return { items: rows.slice(0, 32), charts: charts.slice(0, 4) };
}

const FUTURE_ANALYSIS_SECTIONS = [
  { id: 'fii_details', title: 'Informações Avançadas de FIIs', type: 'table', message: 'Será exibido somente para FIIs quando integrado.' }
];

function pendingSection(spec) {
  return {
    id: spec.id,
    title: spec.title,
    type: spec.type,
    status: 'missing',
    itemCount: 0,
    source: 'VALORAE Proxy',
    items: [],
    message: spec.message || 'Seção ainda não está recebendo dados reais pelo contrato único.'
  };
}

function section(id, title, type, items, source = 'VALORAE Proxy', extra = {}) {
  const safeItems = Array.isArray(items) ? items.filter(item => cleanText(item?.label) && cleanText(item?.value)) : [];
  const safeCharts = Array.isArray(extra.charts) ? extra.charts.filter(chart => cleanText(chart?.title) && Array.isArray(chart?.series) && chart.series.some(serie => Array.isArray(serie.points) && serie.points.length)) : [];
  const ready = safeItems.length || safeCharts.length;
  return {
    id,
    title,
    type,
    status: ready ? 'ready' : 'empty',
    itemCount: safeItems.length + safeCharts.length,
    source,
    items: safeItems,
    charts: safeCharts,
    message: ready ? undefined : 'Seção sem dados reais suficientes. O Proxy não envia valores sintéticos.'
  };
}

export function buildAnalysisPageResponse(payload = {}, input = {}) {
  const ticker = cleanText(payload.ticker || payload.symbol || input.ticker || input.symbol || input.q).toUpperCase();
  const assetType = cleanText(payload.assetClass || payload.type || input.type || '').toUpperCase() || 'ACAO';
  const summaryItems = buildSummaryItems(payload, assetType);
  const fundamentalItems = buildFundamentalItems(payload, assetType);
  const dividendSummaryItems = buildDividendSummaryItems(payload, assetType);
  const dividendHistoryItems = buildDividendHistoryItems(payload);
  const historicalItems = buildHistoricalIndicatorItems(payload);
  const statementItems = buildFinancialStatementItems(payload);
  const assetCharts = buildAssetCharts(payload);
  const companyProfileItems = buildCompanyProfileItems(payload, assetType);
  const revenueBreakdown = buildRevenueBreakdown(payload);
  const comparisons = buildComparisonItemsAndCharts(payload);

  const coreSections = [
    section('summary', assetType === 'FII' ? 'Resumo do FII' : 'Resumo do Ativo', 'metric_cards', summaryItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('fundamental_indicators', 'Indicadores Fundamentalistas', 'metric_grid', fundamentalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('dividends_summary', assetType === 'FII' ? 'Rendimentos' : 'Dividendos e Proventos', 'metric_cards', dividendSummaryItems, 'StatusInvest proventos por ativo'),
    section('dividends_history', 'Histórico de Proventos', 'table', dividendHistoryItems, 'StatusInvest proventos por ativo'),
    section('historical_indicators', 'Histórico de Indicadores', 'table', historicalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('financial_statements', 'DRE, Balanço e Fluxo de Caixa', 'table', statementItems, 'StatusInvest/Yahoo fundamentals normalizados pelo Proxy'),
    section('asset_charts', 'Gráficos do Ativo', 'chart', chartPreviewItems(assetCharts), 'VALORAE Proxy séries estruturadas', { charts: assetCharts }),
    section('company_profile', assetType === 'FII' ? 'Sobre o Fundo' : 'Sobre a Empresa', 'text', companyProfileItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('revenue_breakdown', 'Negócios e Regiões de Receita', 'chart', revenueBreakdown.items, 'Investidor10/StatusInvest normalizados pelo Proxy', { charts: revenueBreakdown.charts }),
    section('comparisons', assetType === 'FII' ? 'Comparadores de FIIs e Índices' : 'Comparadores de Ações e Índices', 'comparison', comparisons.items, 'VALORAE Proxy comparadores estruturados', { charts: comparisons.charts })
  ];

  const sections = [
    ...coreSections,
    ...FUTURE_ANALYSIS_SECTIONS
      .filter(spec => !(assetType !== 'FII' && spec.id === 'fii_details'))
      .map(pendingSection)
  ];
  const ready = sections.filter(s => s.status === 'ready').length;
  const missing = sections.filter(s => s.status !== 'ready');
  const chartCount = sections.reduce((sum, section) => sum + (Array.isArray(section.charts) ? section.charts.length : 0), 0);
  return {
    ok: ready > 0,
    status: ready > 0 ? 'OK' : 'PARTIAL',
    endpoint: 'analysis',
    contract: 'AnalysisPageResponse',
    contractVersion: CONTRACT_VERSION,
    version: RELEASE.version,
    patch: RELEASE.patch,
    ticker,
    symbol: ticker,
    assetType,
    name: cleanText(payload.name || payload.nome || payload.nomeEmpresa || payload.results?.nome || payload.results?.nomeEmpresa || ticker),
    updatedAt: new Date().toISOString(),
    sourcePolicy: 'StatusInvest primário para números estruturados; Investidor10 como referência visual/complemento; sem dados sintéticos.',
    sources: [
      { id: 'statusinvest', role: 'primary_structured_numbers' },
      { id: 'investidor10', role: 'visual_reference_and_complement' },
      { id: 'yahoo', role: 'market_history_and_structured_financials_when_available' }
    ],
    sections,
    summary: {
      totalSections: sections.length,
      readySections: ready,
      emptySections: missing.length,
      missingSections: missing.length,
      totalItems: sections.reduce((sum, item) => sum + item.itemCount, 0),
      totalCharts: chartCount
    },
    missingSignals: missing.map(s => ({ id: s.id, title: s.title, status: s.status, message: s.message })),
    diagnostics: {
      hasQuote: Boolean(cleanText(summaryItems.find(i => i.id === 'price')?.value)),
      summaryItems: summaryItems.length,
      fundamentalItems: fundamentalItems.length,
      dividendSummaryItems: dividendSummaryItems.length,
      dividendHistoryItems: dividendHistoryItems.length,
      historicalItems: historicalItems.length,
      statementItems: statementItems.length,
      assetCharts: assetCharts.length,
      companyProfileItems: companyProfileItems.length,
      revenueBreakdownItems: revenueBreakdown.items.length,
      comparisonItems: comparisons.items.length,
      missingSections: missing.map(s => s.id),
      legacyAssetEndpointUntouched: true,
      payloadSource: payload.source || 'VALORAE Fonte Oficial'
    }
  };
}

export const _test = { STOCK_INDICATORS, buildAnalysisPageResponse, buildSummaryItems, buildFundamentalItems, buildDividendSummaryItems, buildDividendHistoryItems, buildHistoricalIndicatorItems, buildFinancialStatementItems, buildAssetCharts, computeTwelveMonthVariation };
