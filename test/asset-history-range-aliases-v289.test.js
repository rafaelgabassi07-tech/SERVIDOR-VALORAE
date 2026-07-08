import assert from 'node:assert/strict';
import fs from 'node:fs';

const assetDetails = fs.readFileSync(new URL('../lib/sources/asset-details.js', import.meta.url), 'utf8');
const b3Calendar = fs.readFileSync(new URL('../lib/market/b3-calendar.js', import.meta.url), 'utf8');
const yahoo = fs.readFileSync(new URL('../lib/market/yahoo.js', import.meta.url), 'utf8');

assert.match(assetDetails, /'2Y': \{ range: '2y'/, 'PERIOD_MAP precisa aceitar 2Y para não cair em 1Y.');
assert.match(assetDetails, /compact === '1MO'/, 'normalizeRange precisa aceitar aliases Yahoo 1mo.');
assert.match(assetDetails, /r === '1MO'/, 'normalizeRange precisa aceitar 1MO direto.');
assert.match(assetDetails, /compact === 'MAXIMO'/, 'normalizeRange precisa aceitar MÁX/MAXIMO.');
assert.match(assetDetails, /\\u0300-\\u036f/, 'normalizeRange deve remover acentos de forma estável.');
assert.match(b3Calendar, /compact === '1MO'/, 'normalizeB3Range precisa aceitar 1mo nos ativos comuns.');
assert.match(yahoo, /date: new Date\(t \* 1000\)\.toISOString\(\)/, 'Yahoo history retorna date ISO, contrato que o APK v429 passa a aceitar.');

console.log('asset-history-range-aliases-v289 ok');
