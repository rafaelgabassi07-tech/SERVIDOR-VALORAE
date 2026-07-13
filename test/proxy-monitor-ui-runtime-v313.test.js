import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');

assert.equal(index, server, 'index.html e server.html precisam permanecer idênticos');
const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.equal(inlineScripts.length, 1, 'monitor deve manter um bloco inline principal auditável');
assert.doesNotThrow(() => new vm.Script(inlineScripts[0], { filename: 'valorae-proxy-monitor-inline.js' }));
assert.ok(index.includes("launchPatch:'21.12.357-real-indices-peer-patrimony-history-v325'"));
assert.ok(index.includes('id="captureKpis"'));
assert.ok(index.includes('id="captureAudit"'));
assert.ok(index.includes('id="captureScopeBox"'));
assert.ok(index.includes('function renderCapture(d)'));
assert.ok(index.includes('renderCapture(d);renderKpis(d);renderCommand(d)'));
assert.ok(index.includes('/monitor-valorae.css'));
assert.ok(css.includes('--accent:#ffcc5c'));
assert.ok(css.includes('--surface:#1c1c22'));
assert.ok(css.includes('backdrop-filter:none'));
assert.ok(css.includes('background-image:none'));
assert.ok(css.includes('.captureAudit'));
assert.ok(css.includes('@media(max-width:520px)'));

console.log('proxy-monitor-ui-runtime-v313 ok');
