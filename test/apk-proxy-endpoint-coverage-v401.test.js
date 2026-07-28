import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { routeManifest } from '../routes/_router.js';
import { resolveSiblingApkRoot, hasSiblingApk } from './helpers/cross-stack-apk.js';

if (hasSiblingApk()) {
  const root = path.join(resolveSiblingApkRoot(), 'app/src/main/java');
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && entry.name.endsWith('.kt')) files.push(target);
    }
  }
  walk(root);
  const endpoints = new Set();
  const pattern = /["'](\/api\/v1\/[A-Za-z0-9_?&=./{}:-]+)["']/g;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      endpoints.add(match[1].split('?')[0].replace(/^\/api\/v1/, '') || '/');
    }
  }
  const routes = new Set(routeManifest().routes);
  const missing = [...endpoints].filter(endpoint => !routes.has(endpoint)).sort();
  assert.deepEqual(missing, [], `endpoints usados pelo APK sem rota no Proxy: ${missing.join(', ')}`);
  assert.ok(endpoints.has('/mobile/alerts'), 'APK deve declarar o endpoint consolidado de alertas');
  console.log(`apk-proxy endpoint coverage v401 OK: ${endpoints.size} endpoints do APK cobertos`);
} else {
  console.log('apk-proxy endpoint coverage v401 skipped: APK pareado não informado');
}
