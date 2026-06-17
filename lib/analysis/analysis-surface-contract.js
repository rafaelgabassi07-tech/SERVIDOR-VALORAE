export const ANALYSIS_SURFACE_CONTRACT_VERSION = '26.analysis.surface.v2';

export const ANALYSIS_SURFACES = [
  {
    id: 'analysis_page',
    title: 'Página Análise',
    role: 'Tela completa de pesquisa e leitura fundamentalista.',
    density: 'standard',
    maxInitialSections: 24,
    defaultExpandedSectionIds: ['summary', 'fundamental_indicators', 'asset_charts', 'dividends_summary'],
  },
  {
    id: 'portfolio_asset_modal',
    title: 'Modal do ativo em carteira',
    role: 'Reuso da Análise para ativo já presente na carteira, com foco em posição, risco, retorno e fundamentos.',
    density: 'compact',
    maxInitialSections: 12,
    defaultExpandedSectionIds: ['summary', 'fundamental_indicators', 'dividends_summary', 'market_context'],
  },
  {
    id: 'ranking_asset_modal',
    title: 'Modal do ativo no ranking',
    role: 'Reuso da Análise para ativo visto em rankings, com foco em comparabilidade e decisão rápida.',
    density: 'compact',
    maxInitialSections: 10,
    defaultExpandedSectionIds: ['summary', 'fundamental_indicators', 'source_comparatives', 'indices_events'],
  }
];

export const ANALYSIS_SECTION_PRIORITIES = [
  { id: 'summary', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Identificação, preço e leitura rápida.' },
  { id: 'fundamental_indicators', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Principais múltiplos, rentabilidade, dívida e crescimento.' },
  { id: 'dividends_summary', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Rendimento/dividendo atual e histórico curto.' },
  { id: 'market_context', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'expanded', reason: 'Liquidez, faixa de preço, volatilidade e mercado.' },
  { id: 'asset_charts', decisionLevel: 'core', mobileDefault: 'expanded', modalDefault: 'collapsed', reason: 'Séries visuais do ativo.' },
  { id: 'historical_indicators', decisionLevel: 'core', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Evolução dos indicadores ao longo do tempo.' },
  { id: 'valuation_models', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Graham/Bazin quando a fonte fornecer.' },
  { id: 'source_comparatives', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Comparativos por setor, subsetor, segmento ou pares.' },
  { id: 'indices_events', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Participação em IBOV/IFIX e índices relacionados.' },
  { id: 'comparisons', decisionLevel: 'useful', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Comparação com índices oficiais e benchmarks reais.' },
  { id: 'financial_statements', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'DRE, balanço e fluxo para análise profunda.' },
  { id: 'fii_accounting', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Contábil extenso de FIIs.' },
  { id: 'revenue_breakdown', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Segmentação de receita por negócio/região.' },
  { id: 'fii_portfolio', decisionLevel: 'deep', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Imóveis, estados, composição e exposição do FII.' },
  { id: 'company_profile', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Cadastro e descrição sem poluir a leitura principal.' },
  { id: 'governance_events', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Eventos, cadastro operacional e governança.' },
  { id: 'ownership', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Posição acionária quando real.' },
  { id: 'checklist', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Checklist da fonte como leitura auxiliar.' },
  { id: 'fii_details', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Dados cadastrais e operacionais de FII.' },
  { id: 'fii_checklist', decisionLevel: 'support', mobileDefault: 'collapsed', modalDefault: 'collapsed', reason: 'Checklist do FII como leitura auxiliar.' }
];


export function normalizeAnalysisSurfaceId(input = '') {
  const raw = String(input || '').trim().toLowerCase().replace(/[^a-z0-9_:-]/g, '_');
  if (!raw) return 'analysis_page';
  if (raw === 'page' || raw === 'analysis' || raw === 'analysis-page') return 'analysis_page';
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
    surfaces: ANALYSIS_SURFACES.map(surface => ({
      ...surface,
      selected: surface.id === activeSurfaceId,
      readySectionIds: ANALYSIS_SECTION_PRIORITIES
        .filter(item => ready.has(item.id))
        .slice(0, surface.maxInitialSections)
        .map(item => item.id)
    })),
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
      hiddenFromUser,
      neverRenderSyntheticData: true
    }
  };
}
