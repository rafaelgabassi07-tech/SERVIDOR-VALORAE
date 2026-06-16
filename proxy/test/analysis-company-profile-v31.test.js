import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const stockResponse = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  companyInfo: {
    descricao: 'A Petrobras atua de forma integrada na exploração, produção, refino e comercialização de energia.',
    setor: 'Petróleo, Gás e Biocombustíveis',
    subsetor: 'Petróleo, Gás e Biocombustíveis',
    segmento: 'Exploração, Refino e Distribuição',
    cnpj: '33.000.167/0001-01',
    site: 'www.petrobras.com.br',
    atividadePrincipal: 'Exploração e produção de petróleo e gás natural',
    governanca: 'Nível 2',
    tagAlong: '100%',
    freeFloat: '63,5%',
    numeroAcoes: 13044496000,
    valorMercado: 510000000000,
    patrimonioLiquido: 390000000000
  }
}, { ticker: 'PETR4' });

const stockProfile = stockResponse.sections.find(section => section.id === 'company_profile');
assert.ok(stockProfile, 'company_profile precisa existir no AnalysisPageResponse');
assert.equal(stockProfile.status, 'ready');
assert.ok(stockProfile.items.some(item => item.label === 'Sobre a empresa'));
assert.ok(stockProfile.items.some(item => item.label === 'Setor' && item.value.includes('Petróleo')));
assert.ok(stockProfile.items.some(item => item.label === 'CNPJ'));
assert.ok(stockProfile.items.some(item => item.label === 'Governança'));
assert.ok(stockProfile.items.some(item => item.label === 'Tag along'));
assert.ok(stockProfile.items.some(item => item.label === 'Free float'));
assert.ok(stockProfile.items.some(item => item.label === 'Número de ações'));
assert.ok(stockProfile.items.some(item => item.label === 'Valor de mercado' && item.value.startsWith('R$')));
assert.ok(stockProfile.items.some(item => item.label === 'Patrimônio líquido' && item.value.startsWith('R$')));
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'company_profile'), 'company_profile não deve ficar pendente com dados cadastrais reais');

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  results: {
    informacoesFundo: {
      descricao: 'Fundo imobiliário com foco em imóveis logísticos.',
      razaoSocial: 'CSHG Logística Fundo de Investimento Imobiliário',
      cnpj: '11.728.688/0001-47',
      administrador: 'Credit Suisse Hedging-Griffo Corretora de Valores S.A.',
      gestor: 'CSHG Real Estate',
      segmento: 'Logística',
      tipoFundo: 'Tijolo',
      mandato: 'Renda',
      tipoGestao: 'Ativa',
      prazo: 'Indeterminado',
      taxaAdministracao: '0,6% a.a.',
      publicoAlvo: 'Investidores em geral'
    }
  }
}, { ticker: 'HGLG11' });

const fiiProfile = fiiResponse.sections.find(section => section.id === 'company_profile');
assert.ok(fiiProfile, 'company_profile precisa existir para FII');
assert.equal(fiiProfile.title, 'Sobre o Fundo');
assert.equal(fiiProfile.status, 'ready');
assert.ok(fiiProfile.items.some(item => item.label === 'Sobre o fundo'));
assert.ok(fiiProfile.items.some(item => item.label === 'Razão social'));
assert.ok(fiiProfile.items.some(item => item.label === 'Administrador'));
assert.ok(fiiProfile.items.some(item => item.label === 'Gestor'));
assert.ok(fiiProfile.items.some(item => item.label === 'Tipo de fundo'));
assert.ok(fiiProfile.items.some(item => item.label === 'Tipo de gestão'));
assert.ok(fiiProfile.items.some(item => item.label === 'Taxa de administração'));
assert.ok(fiiProfile.items.some(item => item.label === 'Público-alvo'));

const emptyResponse = buildAnalysisPageResponse({ ticker: 'VAZIO3', assetClass: 'ACAO' }, { ticker: 'VAZIO3' });
const emptyProfile = emptyResponse.sections.find(section => section.id === 'company_profile');
assert.equal(emptyProfile.status, 'empty');
assert.ok(emptyResponse.missingSignals.some(signal => signal.id === 'company_profile'), 'sem dados cadastrais reais, seção deve ser sinalizada');

console.log('Checkpoint 31 company/fund profile test OK.');
