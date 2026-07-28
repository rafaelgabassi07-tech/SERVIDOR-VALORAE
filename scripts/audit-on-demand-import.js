let fetchCalls = 0;
let intervalCalls = 0;
let timeoutCalls = 0;
const realFetch = globalThis.fetch;
const realSetInterval = globalThis.setInterval;
const realSetTimeout = globalThis.setTimeout;

globalThis.fetch = async (...args) => {
  fetchCalls += 1;
  throw new Error(`fetch iniciado durante importação: ${String(args[0] || '')}`);
};
globalThis.setInterval = (...args) => {
  intervalCalls += 1;
  return realSetInterval(...args);
};
globalThis.setTimeout = (...args) => {
  timeoutCalls += 1;
  return realSetTimeout(...args);
};

try {
  await import(`../api/router.js?onDemandAudit=${Date.now()}`);
} finally {
  globalThis.fetch = realFetch;
  globalThis.setInterval = realSetInterval;
  globalThis.setTimeout = realSetTimeout;
}

if (fetchCalls || intervalCalls || timeoutCalls) {
  throw new Error(`Runtime iniciou trabalho autônomo na importação: fetch=${fetchCalls}, interval=${intervalCalls}, timeout=${timeoutCalls}`);
}
console.log('On-demand import audit OK: fetch=0, interval=0, timeout=0');
