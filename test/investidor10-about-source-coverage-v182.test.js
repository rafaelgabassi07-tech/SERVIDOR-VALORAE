import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  profilePresentation: {
    source: 'Investidor10 Sobre a empresa',
    summary: 'A Petrobras é uma empresa brasileira que atua de forma integrada na indústria de óleo, gás natural e energia, com operações de exploração, produção, refino, transporte e comercialização.',
    sections: [
      {
        title: 'História',
        text: 'A companhia foi fundada em 1953 e possui trajetória ligada ao desenvolvimento da exploração em águas profundas e ultraprofundas no Brasil.'
      },
      {
        title: 'Informações adicionais',
        text: 'Além da atuação operacional, o Investidor10 apresenta dados de mercado, governança, papéis negociados e informações cadastrais separadas da narrativa.'
      }
    ]
  },
  results: {
    dadosEmpresa: {
      cnpj: '33.000.167/0001-01',
      anoFundacao: '1953',
      anoEstreiaBolsa: '1977',
      numeroFuncionarios: '49.000',
      segmentoListagem: 'Nível 2',
      papeisEmpresa: 'PETR3, PETR4',
      papeisFracionados: 'PETR3F, PETR4F'
    }
  }
}, { ticker: 'PETR4' });

const profile = response.sections.find(section => section.id === 'company_profile');
assert.ok(profile, 'company_profile precisa existir');
assert.equal(profile.status, 'ready');
assert.equal(profile.items[0].id, 'profile_description', 'descrição textual deve vir antes de dados cadastrais');
assert.equal(profile.items[0].group, 'Descrição');
assert.ok(profile.items[0].value.includes('indústria de óleo'), 'deve preservar texto narrativo do Investidor10');
assert.ok(profile.items.some(item => item.id.startsWith('profile_narrative_') && item.label === 'História'), 'deve preservar bloco narrativo História');
assert.ok(profile.items.some(item => item.label === 'Ano de fundação' && item.value === '1953'), 'deve preservar dados cadastrais separadamente');
assert.ok(profile.items.some(item => item.label === 'Papéis da empresa' && item.value.includes('PETR4')), 'deve preservar papéis negociados');

console.log('Investidor10 about source coverage v182 test OK.');
