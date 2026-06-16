import { RELEASE } from '../core/release.js';

const CONTRACT_VERSION = '25.analysis.v1';

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

const FUTURE_ANALYSIS_SECTIONS = [
  { id: 'historical_indicators', title: 'Histórico de Indicadores', type: 'table', message: 'Ainda não integrado ao contrato único da Análise.' },
  { id: 'financial_statements', title: 'DRE, Balanço e Fluxo de Caixa', type: 'table', message: 'Ainda não integrado ao contrato único da Análise.' },
  { id: 'asset_charts', title: 'Gráficos do Ativo', type: 'chart', message: 'Aguardando séries estruturadas confiáveis, sem HTML bruto ou simulação.' },
  { id: 'company_profile', title: 'Sobre a Empresa/Fundo', type: 'text', message: 'Ainda não integrado ao contrato único da Análise.' },
  { id: 'revenue_breakdown', title: 'Negócios e Regiões de Receita', type: 'chart', message: 'Ainda não integrado ao contrato único da Análise.' },
  { id: 'comparisons', title: 'Comparadores', type: 'comparison', message: 'Ainda não integrado ao contrato único da Análise.' },
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

function section(id, title, type, items, source = 'VALORAE Proxy') {
  const safeItems = Array.isArray(items) ? items.filter(item => cleanText(item?.label) && cleanText(item?.value)) : [];
  return {
    id,
    title,
    type,
    status: safeItems.length ? 'ready' : 'empty',
    itemCount: safeItems.length,
    source,
    items: safeItems,
    message: safeItems.length ? undefined : 'Seção sem dados reais suficientes. O Proxy não envia valores sintéticos.'
  };
}

export function buildAnalysisPageResponse(payload = {}, input = {}) {
  const ticker = cleanText(payload.ticker || payload.symbol || input.ticker || input.symbol || input.q).toUpperCase();
  const assetType = cleanText(payload.assetClass || payload.type || input.type || '').toUpperCase() || 'ACAO';
  const summaryItems = buildSummaryItems(payload, assetType);
  const fundamentalItems = buildFundamentalItems(payload, assetType);
  const dividendSummaryItems = buildDividendSummaryItems(payload, assetType);
  const dividendHistoryItems = buildDividendHistoryItems(payload);
  const coreSections = [
    section('summary', assetType === 'FII' ? 'Resumo do FII' : 'Resumo do Ativo', 'metric_cards', summaryItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('fundamental_indicators', 'Indicadores Fundamentalistas', 'metric_grid', fundamentalItems, 'StatusInvest + Investidor10 normalizados pelo Proxy'),
    section('dividends_summary', assetType === 'FII' ? 'Rendimentos' : 'Dividendos e Proventos', 'metric_cards', dividendSummaryItems, 'StatusInvest proventos por ativo'),
    section('dividends_history', 'Histórico de Proventos', 'table', dividendHistoryItems, 'StatusInvest proventos por ativo')
  ];
  const sections = [
    ...coreSections,
    ...FUTURE_ANALYSIS_SECTIONS
      .filter(spec => !(assetType !== 'FII' && spec.id === 'fii_details'))
      .map(pendingSection)
  ];
  const ready = sections.filter(s => s.status === 'ready').length;
  const missing = sections.filter(s => s.status !== 'ready');
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
      { id: 'investidor10', role: 'visual_reference_and_complement' }
    ],
    sections,
    summary: {
      totalSections: sections.length,
      readySections: ready,
      emptySections: missing.length,
      missingSections: missing.length,
      totalItems: sections.reduce((sum, item) => sum + item.itemCount, 0)
    },
    missingSignals: missing.map(s => ({ id: s.id, title: s.title, status: s.status, message: s.message })),
    diagnostics: {
      hasQuote: Boolean(cleanText(summaryItems.find(i => i.id === 'price')?.value)),
      summaryItems: summaryItems.length,
      fundamentalItems: fundamentalItems.length,
      dividendSummaryItems: dividendSummaryItems.length,
      dividendHistoryItems: dividendHistoryItems.length,
      missingSections: missing.map(s => s.id),
      legacyAssetEndpointUntouched: true,
      payloadSource: payload.source || 'VALORAE Fonte Oficial'
    }
  };
}

export const _test = { STOCK_INDICATORS, buildAnalysisPageResponse, buildSummaryItems, buildFundamentalItems, buildDividendSummaryItems, buildDividendHistoryItems, computeTwelveMonthVariation };
