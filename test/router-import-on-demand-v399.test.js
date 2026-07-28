import assert from 'node:assert/strict';

let fetchCalls = 0;
let intervalCalls = 0;
let timeoutCalls = 0;
const originalFetch = globalThis.fetch;
const originalSetInterval = globalThis.setInterval;
const originalSetTimeout = globalThis.setTimeout;
try {
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('IMPORT_FETCH_FORBIDDEN');
  };
  globalThis.setInterval = (...args) => {
    intervalCalls += 1;
    return originalSetInterval(...args);
  };
  globalThis.setTimeout = (...args) => {
    timeoutCalls += 1;
    return originalSetTimeout(...args);
  };
  await import(`../api/router.js?on-demand-audit=${Date.now()}`);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setInterval = originalSetInterval;
  globalThis.setTimeout = originalSetTimeout;
}

assert.equal(fetchCalls, 0, 'importar o Proxy não pode iniciar rede');
assert.equal(intervalCalls, 0, 'importar o Proxy não pode iniciar polling');
assert.equal(timeoutCalls, 0, 'importar o Proxy não pode agendar trabalho posterior');
console.log('router import on-demand v399 OK');
