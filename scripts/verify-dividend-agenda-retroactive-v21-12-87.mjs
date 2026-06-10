import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const checks = [];
function ok(name, condition) { checks.push([name, Boolean(condition)]); }
const release = read('lib/release/current.js');
const metadata = JSON.parse(read('metadata.json'));
const batch = read('routes/dividends/batch.js');
const insights = read('routes/portfolio/insights-bundle.js');
const next = read('routes/portfolio/next-dividends.js');
const dividends = read('routes/portfolio/dividends.js');
const agenda = read('lib/market/investidor10-dividend-agenda.js');
ok('release 21.12.87', release.includes("VALORAE_PUBLIC_VERSION = '21.12.87'") && metadata.release === '21.12.87-agenda-proventos-retroactive-cleanup');
ok('batch aceita 45 tickers', /MAX_TICKERS.*45/.test(batch));
ok('batch usa data-com para elegibilidade', batch.includes("kind === 'eligibility'") && batch.includes('e.dateCom, e.comDate'));
ok('batch janela histórica/futura ampliada', batch.includes('deepMode ? 48 : 24') && batch.includes('deepMode ? 24 : 18'));
ok('insights usa dividendPositions', insights.includes('dividendPositions') && insights.includes('cleanDividendTickers'));
ok('insights usa data-com para elegibilidade', insights.includes("kind === 'eligibility'") && insights.includes('eligibilityDate') && insights.includes('e.dateCom, e.comDate'));
ok('agenda prioriza futuro', agenda.includes('futureFirst') && agenda.includes('priorityMode'));
ok('parser aceita pagamento provisionado', agenda.includes('Provisionado|A confirmar|Sem data'));
ok('rotas legadas ampliadas', /MAX_TICKERS.*45/.test(next) && /MAX_TICKERS.*45/.test(dividends));
const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error('VALORAE Proxy dividend agenda v21.12.87 FAILED');
  for (const [name] of failed) console.error('-', name);
  process.exit(1);
}
console.log('VALORAE Proxy dividend agenda v21.12.87 OK');
for (const [name] of checks) console.log('-', name);
