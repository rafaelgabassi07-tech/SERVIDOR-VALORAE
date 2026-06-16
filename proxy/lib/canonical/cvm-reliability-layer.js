// Camada canônica VALORAE/CVM.
// Objetivo: reduzir PARTIAL estrutural sem substituir dados ricos de Investidor10/StatusInvest.
// Esta camada só preenche campos lentos/identidade/fundamentos estáveis quando estão ausentes.

export const VALORAE_CANONICAL_RELIABILITY_VERSION = '21.12.52-news-reliability-upgrade';

const DEFAULT_CVM_DATASETS = Object.freeze({
  portal: 'https://dados.cvm.gov.br/',
  companyGroup: 'https://dados.cvm.gov.br/group/companhias',
  cadastralCompanies: 'https://dados.cvm.gov.br/dataset/cia_aberta-cad',
  dfp: 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-dfp',
  itr: 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-itr',
  fundsGroup: 'https://dados.cvm.gov.br/group/fundos-de-investimento',
});

// Semente pequena e segura para uso pessoal/offline. Em produção, pode ser ampliada por
// VALORAE_CANONICAL_REGISTRY_JSON ou por arquivos gerados a partir dos Dados Abertos CVM.
const SEED_REGISTRY = Object.freeze({
  PETR3: { issuerKey: 'PETR', companyName: 'Petróleo Brasileiro S.A. - Petrobras', displayName: 'Petrobras', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Petróleo, Gás e Biocombustíveis' },
  PETR4: { issuerKey: 'PETR', companyName: 'Petróleo Brasileiro S.A. - Petrobras', displayName: 'Petrobras', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Petróleo, Gás e Biocombustíveis' },
  VALE3: { issuerKey: 'VALE', companyName: 'Vale S.A.', displayName: 'Vale', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Materiais Básicos' },
  ITUB3: { issuerKey: 'ITUB', companyName: 'Itaú Unibanco Holding S.A.', displayName: 'Itaú Unibanco', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Financeiro' },
  ITUB4: { issuerKey: 'ITUB', companyName: 'Itaú Unibanco Holding S.A.', displayName: 'Itaú Unibanco', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Financeiro' },
  BBDC3: { issuerKey: 'BBDC', companyName: 'Banco Bradesco S.A.', displayName: 'Bradesco', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Financeiro' },
  BBDC4: { issuerKey: 'BBDC', companyName: 'Banco Bradesco S.A.', displayName: 'Bradesco', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Financeiro' },
  BBAS3: { issuerKey: 'BBAS', companyName: 'Banco do Brasil S.A.', displayName: 'Banco do Brasil', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Financeiro' },
  ABEV3: { issuerKey: 'ABEV', companyName: 'Ambev S.A.', displayName: 'Ambev', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Consumo não Cíclico' },
  WEGE3: { issuerKey: 'WEGE', companyName: 'WEG S.A.', displayName: 'WEG', assetClass: 'ACAO', market: 'B3', country: 'BR', sectorHint: 'Bens Industriais' },
  GARE11: { issuerKey: 'GARE', displayName: 'GARE11', assetClass: 'FII', market: 'B3', country: 'BR', sectorHint: 'Fundo Imobiliário' },
  MXRF11: { issuerKey: 'MXRF', displayName: 'MXRF11', assetClass: 'FII', market: 'B3', country: 'BR', sectorHint: 'Fundo Imobiliário' },
});

function boolEnv(name, fallback = false) {
  const raw = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(String(raw).toLowerCase());
}

function parseRegistryFromEnv() {
  const raw = typeof process !== 'undefined' ? process.env?.VALORAE_CANONICAL_REGISTRY_JSON : '';
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function cleanTicker(ticker = '') {
  return String(ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function hasValue(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
}

function setMissing(target, key, value, applied) {
  if (!hasValue(value)) return;
  if (!hasValue(target[key])) {
    target[key] = value;
    applied.push(key);
  }
}

function ensureObject(target, key) {
  if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) target[key] = {};
  return target[key];
}

function mergeMissingObject(target, key, values, applied) {
  if (!values || typeof values !== 'object') return;
  const obj = ensureObject(target, key);
  const used = [];
  for (const [childKey, value] of Object.entries(values)) {
    if (!hasValue(value)) continue;
    if (!hasValue(obj[childKey])) {
      obj[childKey] = value;
      used.push(childKey);
    }
  }
  if (used.length) applied.push(`${key}.{${used.join(',')}}`);
}

export function getCanonicalAssetSnapshot(ticker = '', type = '') {
  const enabled = boolEnv('VALORAE_CANONICAL_DATA_ENABLED', true);
  if (!enabled) return null;
  const canonicalTicker = cleanTicker(ticker);
  const envRegistry = parseRegistryFromEnv();
  const entry = envRegistry[canonicalTicker] || envRegistry[canonicalTicker.replace(/\d+$/, '')] || (boolEnv('VALORAE_CANONICAL_SEED_ENABLED', true) ? SEED_REGISTRY[canonicalTicker] : null);
  if (!entry) return null;
  const assetClass = entry.assetClass || type || (/11$/.test(canonicalTicker) ? 'FII' : 'ACAO');
  return {
    version: VALORAE_CANONICAL_RELIABILITY_VERSION,
    provider: 'CVM/OpenData canonical layer',
    source: 'cvm-canonical-cache',
    ticker: canonicalTicker,
    type: assetClass,
    issuerKey: entry.issuerKey,
    displayName: entry.displayName || entry.nome || entry.companyName,
    companyName: entry.companyName || entry.razaoSocial || entry.displayName,
    cnpj: entry.cnpj,
    sectorHint: entry.sectorHint || entry.setor,
    segmentHint: entry.segmentHint || entry.segmento,
    market: entry.market || 'B3',
    country: entry.country || 'BR',
    cvmCode: entry.cvmCode || entry.codigoCvm,
    datasets: DEFAULT_CVM_DATASETS,
    freshness: {
      model: 'slow-data-cache',
      liveQuoteRequired: false,
      recommendedRefresh: 'daily-or-on-demand',
    },
  };
}

export function applyCanonicalReliabilityLayer(ticker = '', type = '', currentResults = {}, context = {}) {
  const results = currentResults && typeof currentResults === 'object' ? { ...currentResults } : {};
  const snapshot = getCanonicalAssetSnapshot(ticker, type);
  const appliedFields = [];
  if (snapshot) {
    setMissing(results, 'nome', snapshot.displayName || snapshot.companyName, appliedFields);
    setMissing(results, 'empresa', snapshot.companyName || snapshot.displayName, appliedFields);
    setMissing(results, 'razaoSocial', snapshot.companyName, appliedFields);
    setMissing(results, 'cnpj', snapshot.cnpj, appliedFields);
    setMissing(results, 'setor', snapshot.sectorHint, appliedFields);
    setMissing(results, 'segmento', snapshot.segmentHint, appliedFields);
    setMissing(results, 'mercado', snapshot.market, appliedFields);
    setMissing(results, 'pais', snapshot.country, appliedFields);
    setMissing(results, 'codigoCvm', snapshot.cvmCode, appliedFields);
    setMissing(results, 'canonicalSource', snapshot.source, appliedFields);
    mergeMissingObject(results, type === 'FII' ? 'informacoesFundo' : 'dadosEmpresa', {
      nome: snapshot.displayName,
      razaoSocial: snapshot.companyName,
      cnpj: snapshot.cnpj,
      setor: snapshot.sectorHint,
      segmento: snapshot.segmentHint,
      mercado: snapshot.market,
      pais: snapshot.country,
      codigoCvm: snapshot.cvmCode,
      fonteCanonic: snapshot.source,
    }, appliedFields);
  }

  const reliability = buildDataReliabilityBlocks(ticker, type, results, {
    snapshot,
    appliedFields,
    richSourceSignals: context.richSourceSignals || [],
  });

  return {
    results,
    appliedFields,
    snapshot,
    reliability,
    used: appliedFields.length > 0,
  };
}

function countPresent(results = {}, keys = []) {
  return keys.filter(key => hasValue(results[key]) || hasValue(results?.indicadores?.[key]) || hasValue(results?.informacoesEmpresa?.[key]) || hasValue(results?.dadosEmpresa?.[key])).length;
}

function blockStatus(present, expected, optional = false) {
  if (present >= expected) return 'OK';
  if (present > 0) return optional ? 'OPTIONAL_PARTIAL' : 'PARTIAL';
  return optional ? 'OPTIONAL_EMPTY' : 'EMPTY';
}

export function buildDataReliabilityBlocks(ticker = '', type = '', results = {}, context = {}) {
  const quoteKeys = ['precoAtual', 'cotacao', 'variacaoDay', 'variacao12m', 'liquidezDiaria', 'liquidezMediaDiaria'];
  const stockFundamentals = ['dividendYield', 'pl', 'pvp', 'roe', 'roic', 'valorDeMercado', 'patrimonioLiquido', 'lucroLiquido', 'margemLiquida'];
  const fiiFundamentals = ['dividendYield', 'dyMedio5a', 'pvp', 'valorPatrimonial', 'ultimoRendimento', 'vacancia', 'numeroCotistas', 'patrimonioLiquido'];
  const fundamentals = type === 'FII' ? fiiFundamentals : stockFundamentals;
  const identityPresent = countPresent(results, ['nome', 'empresa', 'razaoSocial', 'cnpj', 'setor', 'segmento', 'mercado']);
  const quotePresent = countPresent(results, quoteKeys);
  const fundamentalsPresent = countPresent(results, fundamentals);
  const dividendCount = Array.isArray(results?.dividendos?.historico) ? results.dividendos.historico.length : Array.isArray(results?.historicoDividendos) ? results.historicoDividendos.length : 0;
  const chartCount = Array.isArray(results?.chartSeries) ? results.chartSeries.length : Array.isArray(results?.series) ? results.series.length : 0;
  const rankingPresent = countPresent(results, ['comparativoSetor', 'ranking', 'rankings', 'rankingSetor']);

  const blocks = {
    identity: {
      status: blockStatus(identityPresent, 2),
      present: identityPresent,
      expected: 2,
      source: context.snapshot ? 'cvm-canonical+live-if-present' : 'live-or-cache',
    },
    quote: {
      status: blockStatus(quotePresent, 2),
      present: quotePresent,
      expected: 2,
      source: 'live-cache-yahoo-or-provider',
    },
    fundamentals: {
      status: blockStatus(fundamentalsPresent, type === 'FII' ? 4 : 5),
      present: fundamentalsPresent,
      expected: type === 'FII' ? 4 : 5,
      source: 'investidor10-statusinvest-cvm-cache',
    },
    dividends: {
      status: dividendCount ? 'OK' : 'OPTIONAL_EMPTY',
      count: dividendCount,
      source: 'investidor10-statusinvest-rich-layer',
    },
    charts: {
      status: chartCount ? 'OK' : 'OPTIONAL_EMPTY',
      count: chartCount,
      source: 'investidor10-statusinvest-app-payload',
    },
    rankings: {
      status: rankingPresent ? 'OK' : 'OPTIONAL_EMPTY',
      present: rankingPresent,
      source: 'investidor10-statusinvest-rich-layer',
    },
  };

  const coreRenderable = blocks.identity.status !== 'EMPTY' && (blocks.quote.status !== 'EMPTY' || blocks.fundamentals.status !== 'EMPTY');
  const richPreserved = true;
  return {
    version: VALORAE_CANONICAL_RELIABILITY_VERSION,
    ticker: cleanTicker(ticker),
    type,
    globalState: coreRenderable ? 'RENDERABLE_WITH_BLOCK_STATUS' : 'PARTIAL_SOURCE_DATA',
    renderableCore: coreRenderable,
    partialIsBlockLevel: coreRenderable,
    blocks,
    appliedCanonicalFields: Array.isArray(context.appliedFields) ? context.appliedFields : [],
    canonicalSnapshotAvailable: Boolean(context.snapshot),
    cvmDatasets: DEFAULT_CVM_DATASETS,
    providerStrategy: {
      canonicalFoundation: 'CVM/open-data cache for slow identity/fundamental metadata',
      richLiveData: 'Investidor10 and StatusInvest remain enabled for charts, rankings, dividends, descriptions and rich indicators',
      liveQuote: 'Yahoo/HTML providers continue as fast quote layer',
      noOverwritePolicy: true,
      richProvidersPreserved: richPreserved,
    },
    appGuidance: coreRenderable
      ? 'Renderize os blocos disponíveis; mostre avisos por bloco em vez de apagar a tela inteira.'
      : 'Mantenha último snapshot bom e mostre banner de fonte parcial.',
  };
}

export function canonicalReliabilityCapabilities() {
  return {
    version: VALORAE_CANONICAL_RELIABILITY_VERSION,
    enabled: boolEnv('VALORAE_CANONICAL_DATA_ENABLED', true),
    seedEnabled: boolEnv('VALORAE_CANONICAL_SEED_ENABLED', true),
    supportedTickers: Object.keys(SEED_REGISTRY),
    datasets: DEFAULT_CVM_DATASETS,
    policy: 'fill-missing-only-preserve-rich-live-data',
  };
}
