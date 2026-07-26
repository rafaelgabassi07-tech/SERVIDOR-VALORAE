import assert from 'node:assert/strict';
import fs from 'node:fs';

const news = fs.readFileSync(new URL('../lib/sources/news.js', import.meta.url), 'utf8');
const metadata = JSON.parse(fs.readFileSync(new URL('../metadata.json', import.meta.url), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(metadata.apkVersion, '2026.07.25.04');
assert.match(metadata.contractVersion, /APK v541/);
assert.equal(packageJson.valorae.apkVersion, '2026.07.25.04');
assert.match(news, /google\.com\/s2\/favicons\?domain=.*sz=128/);
for (const alias of ['articleImageUrl', 'article_image_url', 'imageUrl', 'image_url', 'thumbnailUrl', 'thumbnail_url']) {
  assert.ok(news.includes(alias), `alias visual ausente: ${alias}`);
}
assert.match(news, /media:content/);
assert.match(news, /media:thumbnail/);
assert.match(news, /og:image/);
assert.match(news, /twitter:image/);
assert.match(news, /sourceLogoUrl/);
console.log('news-visual-branding-apk-v541 ok');
