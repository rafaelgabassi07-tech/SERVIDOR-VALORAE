import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('routes/news.js', 'utf8');
const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');

assert.ok(route.includes('ticker ? validarTicker(ticker) : null'), 'rota /api/v1/news deve aceitar consulta global sem ticker');
assert.ok(engine.includes("news:${clean || 'GERAL'}"), 'cache de notícias globais deve usar chave GERAL');
assert.ok(engine.includes('const isGeneralNews = !clean'), 'engine deve diferenciar notícias globais de notícias por ativo');
assert.ok(engine.includes('bolsa brasileira') && engine.includes('Ibovespa'), 'consulta global deve usar termos de mercado brasileiro');

console.log('news-global-route-v21-12-72 OK');
