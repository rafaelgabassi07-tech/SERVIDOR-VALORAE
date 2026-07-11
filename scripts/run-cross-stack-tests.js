import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertSiblingApkAvailable, resolveSiblingApkRoot } from '../test/helpers/cross-stack-apk.js';

process.env.VALORAE_REQUIRE_APK = '1';
const apkRoot = assertSiblingApkAvailable();
const testRoot = path.resolve('test');
const selected = fs.readdirSync(testRoot)
  .filter(name => name.endsWith('.test.js'))
  .map(name => path.join(testRoot, name))
  .filter(file => fs.readFileSync(file, 'utf8').includes("./helpers/cross-stack-apk.js"))
  .sort();

if (!selected.length) throw new Error('Nenhum teste APK/Proxy foi localizado.');
let failures = 0;
for (const file of selected) {
  try {
    await import(pathToFileURL(file).href);
    console.log('ok', file);
  } catch (error) {
    failures += 1;
    console.error('fail', file, error);
  }
}
if (failures) process.exit(1);
console.log(`${selected.length} testes cross-stack; failures=0; apkRoot=${resolveSiblingApkRoot()}`);
