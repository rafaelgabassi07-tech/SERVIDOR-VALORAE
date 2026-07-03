export const ANALYSIS_SURFACE_CONTRACT_VERSION = '26.analysis.surface.v4';

export const ANALYSIS_SURFACES = [
  {
    id: 'analysis_page',
    title: 'Página Análise',
    role: 'Tela completa de pesquisa e leitura fundamentalista.',
    density: 'standard',
    maxInitialSections: 24,
    defaultExpandedSectionIds: ['summary', 'fundamental_indicators', 'asset_charts', 'dividends_summary', 'dividend_radar'],
  },
  {
    id: 'analysis_asset_modal',
    title: 'Modal da página Análise',
    role: 'Modal reiniciado do zero; sem dados legados enquanto o novo contrato é desenhado.',
    density: 'blank',
    maxInitialSections: 0,
    defaultExpandedSectionIds: [],
  },
  {
    id: 'portfolio_asset_modal',
    title: 'Modal do ativo em carteira',
    role: 'Modal curado para ativo já presente na Carteira, com somente as informações definidas para leitura rápida.',
    density: 'compact',
    maxInitialSections: 9,
    defaultExpandedSectionIds: ['asset_charts', 'summary', 'fundamental_indicators', 'company_profile', 'dividends_history', 'dividend_radar', 'checklist', 'fii_checklist', 'historical_indicators', 'revenue_breakdown', 'dividends_summary'],
  },
  {
    id: 'ranking_asset_modal',
    title: 'Modal do ativo no ranking',
    role: 'Modal curado para ativo visto nos rankings, com somente os blocos essenciais solicitados para decisão rápida.',
    density: 'compact',
    maxInitialSections: 9,
    defaultExpandedSectionIds: ['asset_charts', 'summary', 'fundamental_indicators', 'company_profile', 'dividends_history', 'dividend_radar', 'checklist', 'fii_checklist', 'historical_indicators', 'revenue_breakdown', 'dividends_summary'],
  }
];

export const ANALYSIS_MODAL_SECTION_IDS = [
  'asset_charts',
  'summary',
  'fundamental_indicators',
  'peer_fundamental_comparator',
  'company_profile',
  'fii_details',
  'dividends_history',
  'dividend_radar',
  'checklist',
  'fii_checklist',
  'historical_indicators',
  'revenue_breakdown',
  'dividends_summary'
];

export const ANALYSIS_MODAL_DISPLAY_BLOCKS = [
  'realtime_quote_chart',
  'summary',
  'fundamental_indicators',
  'peer_fundamental_comparator',
  'company_profile',
  'dividends_history',
  'dividend_radar',
  'checklist',
  'fii_checklist',
  'revenue_profit_chart',
  'historical_indicators',
  'revenue_breakdown',
  'dividends_summary'
];

export const ANALYSIS_SECTION_PRIORITIES = [
  { id: 'summary', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Identificação, preço e leitura rápida.' },
  { id: 'fundamental_indicators', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Principais múltiplos, rentabilidade, dívida e crescimento.' },
  { id: 'dividends_summary', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Rendimento/dividendo atual e histórico curto.' },
  { id: 'dividend_radar', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Radar inteligente de meses prováveis de proventos para ações.' },
  { id: 'market_context', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Liquidez, faixa de preço, volatilidade e mercado.' },
  { id: 'asset_charts', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'collapsed', reason: 'Séries visuais do ativo.' },
  { id: 'historical_indicators', decisionLevel: 'core', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Evolução dos indicadores ao longo do tempo.' },
  { id: 'valuation_models', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Graham/Bazin quando a fonte fornecer.' },
  { id: 'source_comparatives', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Comparativos por setor, subsetor, segmento ou pares.' },
  { id: 'peer_fundamental_comparator', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Tabela do Investidor10 comparando fundamentos do ativo com pares/segmento e indicando o melhor por métrica.' },
  { id: 'indices_events', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Participação em IBOV/IFIX e índices relacionados.' },
  { id: 'comparisons', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Comparação com índices oficiais e benchmarks reais.' },
  { id: 'financial_statements', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'DRE, balanço e fluxo para análise profunda.' },
  { id: 'fii_accounting', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Contábil extenso de FIIs.' },
  { id: 'revenue_breakdown', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Segmentação de receita por negócio/região.' },
  { id: 'fii_portfolio', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Imóveis, estados, composição e exposição do FII.' },
  { id: 'company_profile', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Cadastro e descrição sem poluir a leitura principal.' },
  { id: 'governance_events', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Eventos, cadastro operacional e governança.' },
  { id: 'ownership', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Posição acionária quando real.' },
  { id: 'checklist', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Checklist Buy and Hold visual extraído/avaliado pela fonte.' },
  { id: 'fii_details', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Dados cadastrais e operacionais de FII.' },
  { id: 'fii_checklist', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Checklist Buy and Hold visual específico de FIIs.' }
];


export function normalizeAnalysisSurfaceId(input = '') {
  const raw = String(input || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
  if (!raw) return 'analysis_page';
  if (raw === 'page' || raw === 'analysis' || raw === 'analysis-page') return 'analysis_page';
  if (raw === 'analysis_asset_modal' || raw === 'analysis-modal' || raw === 'analysis_modal' || raw === 'asset-analysis-modal') return 'analysis_asset_modal';
  if (raw === 'portfolio' || raw === 'wallet' || raw === 'portfolio-modal' || raw === 'portfolio_asset') return 'portfolio_asset_modal';
  if (raw === 'ranking' || raw === 'ranking-modal' || raw === 'market-ranking' || raw === 'ranking_asset') return 'ranking_asset_modal';
  return ANALYSIS_SURFACES.some(surface => surface.id === raw) ? raw : 'analysis_page';
}

export function getAnalysisSurface(surfaceId = 'analysis_page') {
  const id = normalizeAnalysisSurfaceId(surfaceId);
  return ANALYSIS_SURFACES.find(surface => surface.id === id) || ANALYSIS_SURFACES[0];
}

export function buildAnalysisConsumerContract(assetType = '', sections = [], requestedSurfaceId = 'analysis_page') {
  const ready = new Set((sections || []).filter(section => section?.status === 'ready' || section?.items?.length || section?.charts?.length).map(section => String(section.id || '').toLowerCase()));
  const type = String(assetType || '').toUpperCase();
  const activeSurfaceId = normalizeAnalysisSurfaceId(requestedSurfaceId);
  const activeSurface = getAnalysisSurface(activeSurfaceId);
  const hiddenFromUser = ['diagnostics', 'sourceExtractionTechnologies', 'sourceCoverage', 'sourceDriftReports', 'missingSignals'];
  return {
    version: ANALYSIS_SURFACE_CONTRACT_VERSION,
    activeSurfaceId,
    activeSurface,
    intendedConsumers: ANALYSIS_SURFACES.map(surface => surface.id),
    surfaces: ANALYSIS_SURFACES.map(surface => {
      const allowed = surface.id === 'analysis_page' ? null : new Set(ANALYSIS_MODAL_SECTION_IDS);
      return {
        ...surface,
        selected: surface.id === activeSurfaceId,
        readySectionIds: ANALYSIS_SECTION_PRIORITIES
          .filter(item => ready.has(item.id))
          .filter(item => !allowed || allowed.has(item.id))
          .map(item => item.id)
      };
    }),
    sectionPriorities: ANALYSIS_SECTION_PRIORITIES.map((item, index) => ({
      ...item,
      order: index + 1,
      ready: ready.has(item.id),
      expectedForAsset: item.id.startsWith('fii_') ? type === 'FII' : true
    })),
    uiPolicy: {
      showOnlyReadySections: true,
      hideTechnicalDiagnosticsOnMainScreen: true,
      keepDeepDataCollapsed: true,
      modalCuratedSectionIds: ANALYSIS_MODAL_DISPLAY_BLOCKS,
      hiddenFromUser,
      neverRenderSyntheticData: true
    }
  };
}
