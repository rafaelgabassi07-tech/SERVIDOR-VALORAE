import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/sources/news.js';

const candidate = (title, summary = '', symbols = ['PETR4']) =>
  _test.attachNewsMetadata({ title, summary, publishedAt: new Date().toUTCString() }, { querySymbols: symbols });

const tickerOnly = candidate('PETR4 segue no radar dos investidores', 'Sessão sem evento corporativo relevante.');
assert.equal(tickerOnly.notificationCandidate, false, 'menção isolada de ticker não pode gerar push');

const result = candidate('PETR4 divulga resultado trimestral', 'Companhia apresenta balanço e lucro líquido.');
assert.equal(result.notificationCandidate, true, 'resultado corporativo material deve ser candidato');
assert.equal(result.notificationPriority, 'normal', 'resultado comum não deve usar canal crítico por padrão');

const official = candidate('PETR4 publica fato relevante à CVM', 'Comunicado ao mercado sobre aquisição.');
assert.equal(official.notificationCandidate, true);
assert.equal(official.notificationPriority, 'high', 'evento oficial deve usar alta prioridade');

const moderateMove = candidate('PETR4 cai 4,2% após revisão', 'Ação registra queda durante a sessão.');
assert.equal(moderateMove.notificationCandidate, true);
assert.equal(moderateMove.notificationPriority, 'normal', 'movimento de 4% é relevante, mas não crítico');

const extremeMove = candidate('PETR4 despenca 12% após revisão', 'Ação registra forte queda durante a sessão.');
assert.equal(extremeMove.notificationCandidate, true);
assert.equal(extremeMove.notificationPriority, 'high', 'movimento de 10%+ pode usar alta prioridade');

const lowValue = candidate('PETR4: veja por que pode valer a pena', 'Opinião, guia e ranking para investidores.');
assert.equal(lowValue.notificationCandidate, false, 'conteúdo editorial de baixo valor não deve gerar push');

assert.equal(_test.hasNewsTerm('mercado europeu avança', 'opa'), false, 'OPA não pode casar com Europa');
assert.equal(_test.catalogNewsAlias('BBAS3'), 'Banco do Brasil');
assert.equal(_test.mentionsNewsSymbol('Banco do Brasil anuncia resultado trimestral', 'BBAS3'), true, 'nome da companhia deve associar a notícia ao ticker conhecido');
assert.equal(_test.mentionsNewsSymbol('Petrobras anuncia dividendos', 'PETR4'), true, 'alias de companhia deve cobrir manchetes sem ticker');
assert.equal(_test.matchesStrictAssetItem({ title: 'Brasil divulga novos dados econômicos' }, { querySymbols: ['BBAS3'] }), false, 'palavra isolada do alias não pode associar notícia ao ativo');
assert.equal(_test.matchesStrictAssetItem({ title: 'Banco do Brasil divulga resultado' }, { querySymbols: ['BBAS3'] }), true, 'alias completo deve associar notícia ao ativo');

const now = Date.now();
const sorted = _test.sortNewsForNotifications([
  { title: 'mais nova mas fraca', notificationCandidate: false, relevanceScore: 2, publishedAt: new Date(now).toISOString() },
  { title: 'material', notificationCandidate: true, relevanceScore: 18, publishedAt: new Date(now - 60_000).toISOString() },
]);
assert.equal(sorted[0].title, 'material', 'relevância deve vencer recência quando a matéria mais nova não é acionável');

const newsSource = fs.readFileSync(new URL('../lib/sources/news.js', import.meta.url), 'utf8');
const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
assert.match(router, /symbols:\s*symbols\.slice\(0,\s*16\)/, 'bundle mantém limite editorial de 16 ativos');
assert.match(router, /assetOnly:\s*true/);
assert.match(router, /includeGeneral:\s*false/);
assert.match(router, /notificationMode:\s*true/);
assert.match(newsSource, /notificationMode \? 30/, 'radar deve trabalhar com janela recente, sem buscar matéria antiga para push');
assert.match(newsSource, /!notificationMode/, 'retry histórico de 30 dias precisa permanecer fora do modo de notificação');
assert.match(newsSource, /strictQueryTerms/, 'busca de notificação deve usar ticker e alias catalogado');

console.log('OK — política de notícias em segundo plano v420');
