import { normalizeTicker, classifyTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { normalizePositions } from './positions.js';

export const EQUILIBRIUM_CONTRACT_VERSION = 'equilibrium-v2026-06-13.2';

const STOCK_SEGMENT_BY_TICKER = Object.freeze({
  CMIG3: 'Energia Elétrica', CMIG4: 'Energia Elétrica', ELET3: 'Energia Elétrica', ELET6: 'Energia Elétrica', TAEE11: 'Energia Elétrica', ENGI11: 'Energia Elétrica', CPLE3: 'Energia Elétrica', CPLE6: 'Energia Elétrica', EGIE3: 'Energia Elétrica',
  ITSA3: 'Holdings Diversificadas', ITSA4: 'Holdings Diversificadas', BRAP3: 'Holdings Diversificadas', BRAP4: 'Holdings Diversificadas',
  GRND3: 'Calçados', ALPA4: 'Calçados', CAMB3: 'Calçados',
  KLBN3: 'Papel e Celulose', KLBN4: 'Papel e Celulose', KLBN11: 'Papel e Celulose', SUZB3: 'Papel e Celulose', RANI3: 'Papel e Celulose',
  PETR3: 'Exploração e Produção', PETR4: 'Exploração e Produção', PRIO3: 'Exploração e Produção', RRRP3: 'Exploração e Produção', RECV3: 'Exploração e Produção',
  VALE3: 'Minerais Metálicos', CSNA3: 'Siderurgia', GGBR4: 'Siderurgia', GOAU4: 'Siderurgia', USIM5: 'Siderurgia',
  BBAS3: 'Bancos', ITUB3: 'Bancos', ITUB4: 'Bancos', BBDC3: 'Bancos', BBDC4: 'Bancos', SANB11: 'Bancos', BPAC11: 'Bancos',
  B3SA3: 'Serviços Financeiros Diversos', ABEV3: 'Bebidas', WEGE3: 'Máquinas e Equipamentos', RENT3: 'Aluguel de Veículos',
  VIVT3: 'Telecomunicações', TIMS3: 'Telecomunicações', EQTL3: 'Energia Elétrica', RADL3: 'Varejo Farmacêutico', LREN3: 'Vestuário', MGLU3: 'Varejo'
});

const STOCK_SECTOR_BY_TICKER = Object.freeze({
  CMIG3: 'Utilidade Pública', CMIG4: 'Utilidade Pública', ELET3: 'Utilidade Pública', ELET6: 'Utilidade Pública', TAEE11: 'Utilidade Pública', ENGI11: 'Utilidade Pública', CPLE3: 'Utilidade Pública', CPLE6: 'Utilidade Pública', EGIE3: 'Utilidade Pública', EQTL3: 'Utilidade Pública',
  ITSA3: 'Financeiro', ITSA4: 'Financeiro', BRAP3: 'Financeiro', BRAP4: 'Financeiro', BBAS3: 'Financeiro', ITUB3: 'Financeiro', ITUB4: 'Financeiro', BBDC3: 'Financeiro', BBDC4: 'Financeiro', SANB11: 'Financeiro', BPAC11: 'Financeiro', B3SA3: 'Financeiro',
  GRND3: 'Consumo Cíclico', ALPA4: 'Consumo Cíclico', CAMB3: 'Consumo Cíclico', RENT3: 'Consumo Cíclico', LREN3: 'Consumo Cíclico', MGLU3: 'Consumo Cíclico',
  KLBN3: 'Materiais Básicos', KLBN4: 'Materiais Básicos', KLBN11: 'Materiais Básicos', SUZB3: 'Materiais Básicos', RANI3: 'Materiais Básicos', VALE3: 'Materiais Básicos', CSNA3: 'Materiais Básicos', GGBR4: 'Materiais Básicos', GOAU4: 'Materiais Básicos', USIM5: 'Materiais Básicos',
  PETR3: 'Petróleo, Gás e Biocombustíveis', PETR4: 'Petróleo, Gás e Biocombustíveis', PRIO3: 'Petróleo, Gás e Biocombustíveis', RRRP3: 'Petróleo, Gás e Biocombustíveis', RECV3: 'Petróleo, Gás e Biocombustíveis',
  ABEV3: 'Consumo não Cíclico', WEGE3: 'Bens Industriais', VIVT3: 'Comunicações', TIMS3: 'Comunicações', RADL3: 'Saúde'
});

const FII_TYPE_BY_TICKER = Object.freeze({
  GARE11: 'Fundo de Tijolo', GGRC11: 'Fundo de Tijolo', HGLG11: 'Fundo de Tijolo', XPML11: 'Fundo de Tijolo', VISC11: 'Fundo de Tijolo', KNRI11: 'Fundo de Tijolo', BRCO11: 'Fundo de Tijolo', TRXF11: 'Fundo de Tijolo',
  BTCI11: 'Fundo de Papel', KNCR11: 'Fundo de Papel', KNIP11: 'Fundo de Papel', KNSC11: 'Fundo de Papel', MXRF11: 'Fundo de Papel', CPTS11: 'Fundo de Papel', RBRR11: 'Fundo de Papel',
  SNAG11: 'Outro', VGIA11: 'Outro', RURA11: 'Outro', KNCA11: 'Outro',
  IFRA11: 'Outro', JURO11: 'Outro'
});

const FII_SEGMENT_BY_TICKER = Object.freeze({
  GARE11: 'Híbrido', GGRC11: 'Logístico / Indústria / Galpões', HGLG11: 'Logístico / Indústria / Galpões', BRCO11: 'Logístico / Indústria / Galpões',
  XPML11: 'Shoppings', VISC11: 'Shoppings', HSML11: 'Shoppings', MALL11: 'Shoppings',
  KNRI11: 'Híbrido', TRXF11: 'Híbrido',
  BTCI11: 'Títulos e Valores Mobiliários', KNCR11: 'Títulos e Valores Mobiliários', KNIP11: 'Títulos e Valores Mobiliários', KNSC11: 'Títulos e Valores Mobiliários', MXRF11: 'Títulos e Valores Mobiliários', CPTS11: 'Títulos e Valores Mobiliários', RBRR11: 'Títulos e Valores Mobiliários',
  SNAG11: 'Fiagros', VGIA11: 'Fiagros', RURA11: 'Fiagros', KNCA11: 'Fiagros',
  IFRA11: 'Infraestrutura', JURO11: 'Infraestrutura'
});

const ETF_TICKERS = new Set(['BOVA11','IVVB11','SMAL11','HASH11','QBTC11','BOVV11','DIVO11','XFIX11','GOLD11']);
const FOREIGN_TICKERS = new Set(['IVVB11','NASD11','SPXI11','ACWI11','WRLD11','EURP11','USTK11','TECK11','BITH11','HASH11','QBTC11','ETHE11']);
const FIAGRO_PREFIXES = ['SNAG','VGIA','RURA','KNCA','RZAG','AGRX','DCRA','BBGO','CPTR','FGAA'];
const FII_PAPER_PREFIXES = ['KNCR','KNIP','KNSC','BTCI','MXRF','CPTS','RBRR','HCTR','IRDM','RBRY','VGIR','VRTA','HGCR'];
const FII_BRICK_PREFIXES = ['HGLG','GGRC','GARE','XPML','VISC','HSML','MALL','BRCO','KNRI','TRXF','ALZR','BTLG','RBRP','HGRE'];

function cleanText(value) {
  return String(value || '').trim();
}

function cleanUpper(value) {
  return cleanText(value).toUpperCase();
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function normalizeAssetClassLabel(rawClass = '', ticker = '') {
  const t = normalizeTicker(ticker);
  const clean = cleanUpper(rawClass)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const classified = classifyTicker(t);
  if (clean.includes('ETF') || ETF_TICKERS.has(t)) return 'ETF';
  if (clean.includes('BDR') || /[A-Z]{4}3[45]$/.test(t)) return 'BDR';
  if (clean.includes('FII') || clean.includes('FUNDO IMOB')) return 'FIIs';
  if (clean.includes('ACAO') || clean.includes('AÇÃO') || clean.includes('STOCK')) return 'Ações';
  if (classified === 'ACAO' || classified === 'ACAO_UNIT') return 'Ações';
  if (classified === 'FII') return 'FIIs';
  return rawClass ? cleanText(rawClass) : 'Outros';
}

export function isFiiTicker(ticker = '', rawClass = '') {
  return normalizeAssetClassLabel(rawClass, ticker) === 'FIIs';
}

export function isStockTicker(ticker = '', rawClass = '') {
  return normalizeAssetClassLabel(rawClass, ticker) === 'Ações';
}

export function exposureLabel(ticker = '', position = {}) {
  const t = normalizeTicker(ticker);
  const raw = cleanUpper(firstText(position.exposure, position.exposicao, position.geography, position.region, position.country, position.countryExposure, position.market));
  if (/EXTERIOR|GLOBAL|INTERNACIONAL|INTERNATIONAL|FOREIGN|USA|EUA|US|DOLAR|DÓLAR/.test(raw)) return 'Exterior';
  if (FOREIGN_TICKERS.has(t) || /[A-Z]{4}3[45]$/.test(t)) return 'Exterior';
  return 'Nacional';
}

export function stockSegmentFor(ticker = '', position = {}) {
  const t = normalizeTicker(ticker);
  return firstText(position.stockSegment, position.segmentoAcao, position.segmento, position.segment, STOCK_SEGMENT_BY_TICKER[t], position.sector) || 'Segmento a classificar';
}

export function stockSectorFor(ticker = '', position = {}) {
  const t = normalizeTicker(ticker);
  return firstText(position.stockSector, position.setorAcao, position.setor, position.sector, STOCK_SECTOR_BY_TICKER[t]) || 'Setor a classificar';
}

export function fiiTypeFor(ticker = '', position = {}) {
  const t = normalizeTicker(ticker);
  const raw = cleanUpper(firstText(position.fiiType, position.tipoFii, position.tipo, position.type, position.assetClass));
  if (FII_TYPE_BY_TICKER[t]) return FII_TYPE_BY_TICKER[t];
  if (/PAPEL|RECEBIVE|CR[I|A]|TITULO|TÍTULO/.test(raw) || FII_PAPER_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Fundo de Papel';
  if (/TIJOLO|IMOBILI|LOGIST|SHOPPING|LAJE|GALPAO|GALPÃO|RENDA URBANA/.test(raw) || FII_BRICK_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Fundo de Tijolo';
  if (/FIAGRO|AGRO/.test(raw) || FIAGRO_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Outro';
  if (/INFRA/.test(raw)) return 'Outro';
  if (/HIBRIDO|HÍBRIDO/.test(raw)) return 'Fundo de Tijolo';
  return 'Tipo a classificar';
}

export function fiiSegmentFor(ticker = '', position = {}) {
  const t = normalizeTicker(ticker);
  const raw = cleanUpper(firstText(position.fiiSegment, position.segmentoFii, position.segmento, position.segment, position.sector));
  if (FII_SEGMENT_BY_TICKER[t]) return FII_SEGMENT_BY_TICKER[t];
  if (/FIAGRO|AGRO/.test(raw) || FIAGRO_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Fiagros';
  if (/INFRA/.test(raw)) return 'Infraestrutura';
  if (/PAPEL|TITULO|TÍTULO|RECEBIVE|CRI|CRA/.test(raw) || FII_PAPER_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Títulos e Valores Mobiliários';
  if (/LOGIST|INDUSTR|GALPAO|GALPÃO/.test(raw)) return 'Logístico / Indústria / Galpões';
  if (/SHOPPING/.test(raw)) return 'Shoppings';
  if (/HIBRIDO|HÍBRIDO/.test(raw)) return 'Híbrido';
  if (/TIJOLO/.test(raw) || FII_BRICK_PREFIXES.some(prefix => t.startsWith(prefix))) return 'Tijolo diversificado';
  return 'Segmento a classificar';
}

export function enrichEquilibriumPosition(position = {}) {
  const ticker = normalizeTicker(position.ticker || position.symbol || position.codigo);
  const assetClass = normalizeAssetClassLabel(position.assetClass || position.type || position.tipo || '', ticker);
  const enriched = {
    ...position,
    ticker,
    symbol: ticker,
    assetClass,
    type: assetClass,
    currentValue: round(Number(position.marketValue ?? position.currentValue ?? position.value ?? 0) || 0, 2),
    marketValue: round(Number(position.marketValue ?? position.currentValue ?? position.value ?? 0) || 0, 2),
    exposure: exposureLabel(ticker, position),
    geography: exposureLabel(ticker, position),
  };
  if (assetClass === 'Ações') {
    enriched.stockSegment = stockSegmentFor(ticker, position);
    enriched.stockSector = stockSectorFor(ticker, position);
    enriched.segment = enriched.stockSegment;
    enriched.sector = enriched.stockSector;
  } else if (assetClass === 'FIIs') {
    enriched.fiiType = fiiTypeFor(ticker, position);
    enriched.fiiSegment = fiiSegmentFor(ticker, position);
    enriched.segment = enriched.fiiSegment;
    enriched.sector = enriched.fiiSegment;
  } else {
    enriched.segment = firstText(position.segment, position.segmento) || assetClass;
    enriched.sector = firstText(position.sector, position.setor) || assetClass;
  }
  return enriched;
}

function percent(value, total) {
  return total > 0 ? round((Number(value || 0) / total) * 100, 2) : 0;
}

function aggregate(rows, keySelector, valueSelector, extraSelector = () => ({}), totalOverride = null) {
  const map = new Map();
  for (const row of rows) {
    const key = keySelector(row) || 'Não classificado';
    const value = Number(valueSelector(row) || 0);
    if (!(value > 0)) continue;
    const existing = map.get(key) || { key, label: key, value: 0, marketValue: 0, currentValue: 0, count: 0, ...extraSelector(row, key) };
    existing.value += value;
    existing.marketValue += value;
    existing.currentValue += value;
    existing.count += 1;
    map.set(key, existing);
  }
  const total = Number(totalOverride ?? [...map.values()].reduce((sum, item) => sum + item.value, 0));
  return [...map.values()]
    .map(item => ({ ...item, value: round(item.value, 2), marketValue: round(item.marketValue, 2), currentValue: round(item.currentValue, 2), percent: percent(item.value, total), weight: percent(item.value, total) }))
    .sort((a, b) => b.value - a.value);
}

function chartBlock(id, title, rows, centerLabel = '') {
  return {
    id,
    key: id,
    title,
    type: 'donut',
    centerLabel,
    rows,
    data: rows,
    items: rows,
    totalValue: round(rows.reduce((sum, item) => sum + Number(item.value || 0), 0), 2),
  };
}

export function buildEquilibriumContract(payload = {}) {
  const normalized = normalizePositions(payload.positions || []);
  const positions = normalized.map(enrichEquilibriumPosition).filter(p => p.ticker && p.quantity > 0 && p.marketValue > 0);
  const totalValue = round(positions.reduce((sum, p) => sum + p.marketValue, 0), 2);
  const stocks = positions.filter(p => p.assetClass === 'Ações');
  const fiis = positions.filter(p => p.assetClass === 'FIIs');
  const tabs = ['Consolidado', ...(stocks.length ? ['Ações'] : []), ...(fiis.length ? ['FIIs'] : [])];

  const byAsset = aggregate(positions, p => p.ticker, p => p.marketValue, p => ({ ticker: p.ticker, assetClass: p.assetClass }), totalValue);
  const byType = aggregate(positions, p => p.assetClass, p => p.marketValue, () => ({}), totalValue);
  const byExposure = aggregate(positions, p => p.exposure, p => p.marketValue, () => ({}), totalValue);

  const stocksTotal = round(stocks.reduce((sum, p) => sum + p.marketValue, 0), 2);
  const fiisTotal = round(fiis.reduce((sum, p) => sum + p.marketValue, 0), 2);
  const stockByAsset = aggregate(stocks, p => p.ticker, p => p.marketValue, p => ({ ticker: p.ticker, segment: p.stockSegment, sector: p.stockSector }), stocksTotal);
  const stockBySegment = aggregate(stocks, p => p.stockSegment, p => p.marketValue, () => ({}), stocksTotal);
  const stockBySector = aggregate(stocks, p => p.stockSector, p => p.marketValue, () => ({}), stocksTotal);
  const fiiByAsset = aggregate(fiis, p => p.ticker, p => p.marketValue, p => ({ ticker: p.ticker, fiiType: p.fiiType, segment: p.fiiSegment }), fiisTotal);
  const fiiByType = aggregate(fiis, p => p.fiiType, p => p.marketValue, () => ({}), fiisTotal);
  const fiiBySegment = aggregate(fiis, p => p.fiiSegment, p => p.marketValue, () => ({}), fiisTotal);

  const consolidated = {
    title: 'Consolidado',
    charts: [
      chartBlock('position_by_asset', 'Posição atual (ativos)', byAsset, 'Carteira'),
      chartBlock('position_by_asset_type', 'Posição atual (tipo de ativos)', byType, 'Classes'),
      chartBlock('foreign_exposure', 'Exposição ao exterior', byExposure, 'Exposição')
    ],
    byAsset,
    byType,
    byExposure,
  };

  const actions = {
    title: 'Ações',
    enabled: stocks.length > 0,
    totalValue: stocksTotal,
    portfolioPercent: percent(stocksTotal, totalValue),
    charts: [
      chartBlock('stocks_by_asset', 'Posição atual ações', stockByAsset, 'Ações'),
      chartBlock('stocks_by_segment', 'Posição atual das ações por segmento', stockBySegment, 'Segmentos'),
      chartBlock('stocks_by_sector', 'Posição atual das ações por setor', stockBySector, 'Setores')
    ],
    byAsset: stockByAsset,
    bySegment: stockBySegment,
    bySector: stockBySector,
  };

  const fiisBlock = {
    title: 'FIIs',
    enabled: fiis.length > 0,
    totalValue: fiisTotal,
    portfolioPercent: percent(fiisTotal, totalValue),
    charts: [
      chartBlock('fiis_by_asset', 'Posição atual FIIs', fiiByAsset, 'FIIs'),
      chartBlock('fiis_by_type', 'Posição atual dos FIIs por tipo', fiiByType, 'Tipos'),
      chartBlock('fiis_by_segment', 'Posição atual dos FIIs por segmento', fiiBySegment, 'Segmentos')
    ],
    byAsset: fiiByAsset,
    byType: fiiByType,
    bySegment: fiiBySegment,
  };

  const allCharts = [...consolidated.charts, ...(actions.enabled ? actions.charts : []), ...(fiisBlock.enabled ? fiisBlock.charts : [])];
  return {
    status: positions.length ? 'OK' : 'EMPTY',
    endpoint: 'portfolio-equilibrium',
    contractVersion: EQUILIBRIUM_CONTRACT_VERSION,
    source: 'VALORAE Proxy equilibrium contract',
    totalValue,
    tabs,
    positions,
    consolidated,
    actions,
    stocks: actions,
    fiis: fiisBlock,
    allocation: {
      byAsset,
      byType,
      byExposure,
      byStockSegment: stockBySegment,
      byStockSector: stockBySector,
      byFiiType: fiiByType,
      byFiiSegment: fiiBySegment,
    },
    charts: allCharts,
    capabilities: {
      consolidated: true,
      actions: actions.enabled,
      fiis: fiisBlock.enabled,
      requiredCharts: [
        'position_by_asset',
        'position_by_asset_type',
        'foreign_exposure',
        'stocks_by_asset',
        'stocks_by_segment',
        'stocks_by_sector',
        'fiis_by_asset',
        'fiis_by_type',
        'fiis_by_segment'
      ],
      deliveredCharts: allCharts.map(chart => chart.id),
      missingCharts: []
    },
    diagnostics: {
      positionCount: positions.length,
      stockCount: stocks.length,
      fiiCount: fiis.length,
      unknownStockSegments: stocks.filter(p => /classificar/i.test(p.stockSegment)).map(p => p.ticker),
      unknownStockSectors: stocks.filter(p => /classificar/i.test(p.stockSector)).map(p => p.ticker),
      unknownFiiTypes: fiis.filter(p => /classificar/i.test(p.fiiType)).map(p => p.ticker),
      unknownFiiSegments: fiis.filter(p => /classificar/i.test(p.fiiSegment)).map(p => p.ticker),
      note: 'Classificações vêm de campos enviados pelo APK, fonte do ativo quando disponível e catálogo VALORAE de fallback.'
    }
  };
}
