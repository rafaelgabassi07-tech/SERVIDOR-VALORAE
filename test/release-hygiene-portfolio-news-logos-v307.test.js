import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const history = read('lib/portfolio/history.js');
assert.match(history, /function alignIntradaySeriesToCurrentPortfolioValue\(series = \[\]\) \{\s*return series;\s*\}/);
assert.match(history, /adaptiveEdgeLimit = Math\.min\(0\.18, Math\.max\(0\.035, typicalGap \* 7\)\)/);
assert.match(history, /completeValuation === true/);
assert.ok(history.indexOf('alignIntradaySeriesToCurrentPortfolioValue') < history.indexOf('appendCurrentPortfolioPoint'));

const news = read('lib/sources/news.js');
assert.match(news, /status: items\.length \? 'OK' : 'EMPTY'/);
assert.match(news, /searchUrl: fallbackUrl/);
assert.match(news, /const broadQuery = '\(mercado financeiro OR B3 OR ações OR dividendos OR Ibovespa\) Brasil when:1d'/);
assert.doesNotMatch(news, /VALORAE Notícias — abrir busca de notícias do mercado/);
assert.doesNotMatch(news, /articleStatus: 'fallback-search'/);

const logos = read('lib/market/official-logo.js');
assert.match(logos, /classifyTicker\(ticker\)/);
assert.match(logos, /companytickerimage\?ticker=/);
assert.match(logos, /sniffImage\(bytes, contentType/);
assert.match(logos, /VALORAE_ASSET_LOGO_TTL_MS \|\| 30 \* 24 \* 60 \* 60 \* 1000/);

const router = read('routes/_router.js');
assert.match(router, /fetchOfficialAssetLogo/);
assert.match(router, /X-Valorae-Logo-Source/);
assert.match(router, /return res\.end\(logo\.bytes\)/);

const forbiddenNames = /(?:\.tmp|\.bak|~|\.pyc|\.DS_Store)$/;
const ignoredDirs = new Set(['.git', 'node_modules', 'docs']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      assert.ok(!forbiddenNames.test(entry.name), `artefato temporário no release: ${path.relative(root, full)}`);
      assert.ok(!/^RELATORIO.*\.md$/i.test(entry.name), `relatório interno no release: ${path.relative(root, full)}`);
    }
  }
}
walk(root);

console.log('release-hygiene-portfolio-news-logos-v307 ok');
