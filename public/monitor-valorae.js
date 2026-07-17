(() => {
  'use strict';

  const RELEASE_PATCH = '21.12.381-monitor-live-stream-v349';
  const STORAGE = {
    theme: 'valorae:monitor:theme',
    apiBase: 'valorae:monitor:apiBase',
    poll: 'valorae:monitor:pollMs',
    feedLimit: 'valorae:monitor:feedLimit',
    view: 'valorae:monitor:view',
  };
  const VIEW_ALIASES = {
    command: 'live', output: 'live', feed: 'live', overview: 'live',
    performance: 'health', quality: 'health', diagnostics: 'health', benchmark: 'health',
    architecture: 'routes', integration: 'routes', io: 'routes', technology: 'routes',
  };

  const $ = id => document.getElementById(id);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safeStorage = {
    get(key, fallback = '') { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} },
    remove(key) { try { localStorage.removeItem(key); } catch {} },
  };
  const state = {
    data: null,
    events: [],
    filteredEvents: [],
    selectedId: null,
    paused: false,
    loading: false,
    timer: null,
    requestController: null,
    pollMs: boundedNumber(safeStorage.get(STORAGE.poll, '3000'), 3000, 2000, 10000),
    feedLimit: boundedNumber(safeStorage.get(STORAGE.feedLimit, '60'), 60, 30, 80),
    view: 'live',
    lastSuccessAt: 0,
    error: '',
    rawRenderedAt: '',
  };
  let toastTimer;

  function boundedNumber(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(number) : '—';
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  function formatMs(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    return number >= 1000 ? `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)} s` : `${Math.round(number)} ms`;
  }

  function formatTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function formatDateTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
  }

  function formatAge(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    if (value < 60) return `${Math.round(value)} s`;
    if (value < 3600) return `${Math.floor(value / 60)} min`;
    return `${Math.floor(value / 3600)} h ${Math.floor((value % 3600) / 60)} min`;
  }

  function compactId(value, length = 12) {
    const text = String(value || '—');
    return text.length > length ? `${text.slice(0, length)}…` : text;
  }

  function apiBase() {
    return String(safeStorage.get(STORAGE.apiBase, '') || '').replace(/\/$/, '');
  }

  function apiUrl(path) {
    return `${apiBase()}${path}`;
  }

  function metric(label, value, note = '', tone = '') {
    return `<div class="metric-item"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value ${tone ? `tone-${tone}` : ''}">${escapeHtml(value)}</strong><span class="metric-note">${escapeHtml(note)}</span></div>`;
  }

  function facts(entries) {
    return entries.map(([label, value, tone = '']) => `<div><dt>${escapeHtml(label)}</dt><dd class="${tone ? `tone-${tone}` : ''}">${escapeHtml(value ?? '—')}</dd></div>`).join('');
  }

  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2600);
  }

  function statusTone(status) {
    const code = Number(status || 0);
    if (code >= 400 || code === 0) return 'error';
    if (code >= 300) return 'redirect';
    return 'success';
  }

  function eventIdentity(event) {
    return String(event?.id ?? `${event?.at || ''}-${event?.route || ''}-${event?.requestId || ''}`);
  }

  function setConnection(kind, label) {
    const node = $('connectionState');
    if (!node) return;
    node.className = `connection ${kind || ''}`;
    const text = node.querySelector('span');
    if (text) text.textContent = label;
  }

  function schedule() {
    clearTimeout(state.timer);
    if (state.paused) return;
    state.timer = setTimeout(() => refresh(), state.pollMs);
  }

  async function refresh({ manual = false } = {}) {
    if (state.loading || (state.paused && !manual)) return;
    if (document.hidden && !manual) {
      schedule();
      return;
    }
    state.loading = true;
    state.requestController?.abort();
    const controller = new AbortController();
    state.requestController = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    if (!state.data) setConnection('', 'Conectando');
    try {
      const response = await fetch(apiUrl('/api/server/metrics'), {
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'X-Valorae-App': 'VALORAE Proxy Monitor',
          'X-Valorae-Channel': 'dashboard',
          'X-Valorae-Telemetry': 'dashboard',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || data.ok === false) throw new Error(data?.error || 'Snapshot inválido');
      state.data = data;
      state.events = Array.isArray(data.proxyOutputMonitor?.outputFeed)
        ? data.proxyOutputMonitor.outputFeed
        : Array.isArray(data.recentEvents) ? data.recentEvents : [];
      state.lastSuccessAt = Date.now();
      state.error = '';
      if (!state.selectedId || !state.events.some(event => eventIdentity(event) === state.selectedId)) {
        state.selectedId = state.events[0] ? eventIdentity(state.events[0]) : null;
      }
      setConnection('online', state.paused ? 'Pausado' : 'Ao vivo');
      renderAll();
    } catch (error) {
      if (error?.name !== 'AbortError' || manual) state.error = error?.message || 'Falha de conexão';
      if (state.data) setConnection('stale', 'Dados anteriores');
      else setConnection('offline', 'Sem conexão');
      renderHeader();
    } finally {
      clearTimeout(timeout);
      state.loading = false;
      if (state.requestController === controller) state.requestController = null;
      schedule();
    }
  }

  function renderAll() {
    renderHeader();
    renderLive();
    renderRoutes();
    renderHealth();
    renderSettings();
    if (state.view === 'health') requestAnimationFrame(drawTrafficChart);
  }

  function renderHeader() {
    const data = state.data;
    const summary = data?.summary || {};
    if ($('releaseLabel')) $('releaseLabel').textContent = data?.releasePatch || RELEASE_PATCH;
    if ($('instanceLabel')) $('instanceLabel').textContent = data?.instance?.id ? `instância ${compactId(data.instance.id, 8)}` : 'instância —';
    if ($('updatedLabel')) $('updatedLabel').textContent = state.error
      ? `falha: ${state.error}`
      : state.lastSuccessAt ? `atualizado ${formatTime(state.lastSuccessAt)}` : 'aguardando dados';
    if ($('liveDescription') && data) {
      const stateText = String(summary.trafficState || 'aguardando').replaceAll('_', ' ');
      $('liveDescription').textContent = `${stateText} · ${formatNumber(summary.responses || 0)} respostas registradas desde o início desta instância.`;
    }
  }

  function renderLive() {
    const data = state.data;
    if (!data) {
      $('liveMetrics').innerHTML = Array.from({ length: 6 }, (_, index) => metric(['Requisições', 'Respostas', 'Em voo', 'Erros', 'Latência p95', 'Dados enviados'][index], '—', 'aguardando')).join('');
      $('eventFeed').innerHTML = '<div class="empty-copy">Conectando ao endpoint de métricas…</div>';
      return;
    }
    const summary = data.summary || {};
    $('liveMetrics').innerHTML = [
      metric('Requisições', formatNumber(summary.requests || 0), `${formatNumber(summary.requestsPerMinute1m || 0)}/min agora`),
      metric('Respostas', formatNumber(summary.responses || 0), `${formatNumber(summary.successRatePercent ?? 100)}% sucesso`, (summary.errorRatePercent || 0) > 5 ? 'warning' : 'success'),
      metric('Em voo', formatNumber(summary.inFlight || 0), summary.oldestActiveRoute || 'nenhuma pendência', summary.inFlight ? 'info' : ''),
      metric('Erros', formatNumber(summary.errors || 0), `${formatNumber(summary.errorRatePercent || 0)}% do total`, summary.errors ? 'danger' : 'success'),
      metric('Latência p95', formatMs(summary.p95LatencyMs), `média ${formatMs(summary.avgLatencyMs)}`, (summary.p95LatencyMs || 0) > (summary.sloP95TargetMs || 2500) ? 'warning' : ''),
      metric('Dados enviados', formatBytes(summary.bytesOut || 0), `média ${formatBytes(summary.avgBytesOut || 0)}`),
    ].join('');
    renderCapture(data);
    renderInflight(data.activeRequests || []);
    populateFeedFilters();
    renderFeed();
    const scope = data.proxyOutputMonitor?.scope;
    $('retentionNote').textContent = scope?.persistence || `Até ${formatNumber(summary.eventsStored || state.events.length)} eventos na memória desta instância.`;
  }

  function renderCapture(data) {
    const summary = data.summary || {};
    const percent = Number(summary.captureCompletenessPercent ?? 100);
    const gap = Number(summary.captureGap || 0);
    const kind = gap > 0 || percent < 95 ? 'degraded' : percent < 100 ? 'attention' : 'complete';
    const line = $('captureLine');
    line.className = `capture-line ${kind}`;
    line.innerHTML = `<span class="capture-state"><i aria-hidden="true"></i><strong>${escapeHtml(percent >= 100 && !gap ? 'Captura central íntegra' : 'Captura requer atenção')}</strong></span><span>${escapeHtml(`${formatNumber(percent)}% · ${formatNumber(summary.responses || 0)} eventos · ${formatNumber(gap)} lacunas · ${formatNumber(summary.internalTelemetryRequests || 0)} leituras internas isoladas`)}</span>`;
  }

  function renderInflight(activeRequests) {
    const section = $('inflightSection');
    const list = Array.isArray(activeRequests) ? activeRequests : [];
    section.hidden = list.length === 0;
    $('inflightCount').textContent = formatNumber(list.length);
    $('inflightList').innerHTML = list.map(item => `<div class="inflight-row"><strong>${escapeHtml(`${item.method || 'GET'} ${item.route || '/'}`)}</strong><span>${escapeHtml(`${item.appName || item.device || 'Consumidor'} · ${formatMs(item.ageMs || 0)} · ${formatBytes(item.bytesIn || 0)} recebidos`)}</span></div>`).join('');
  }

  function populateFeedFilters() {
    const methods = [...new Set(state.events.map(event => String(event.method || 'GET').toUpperCase()))].sort();
    const apps = [...new Set(state.events.map(event => String(event.appName || event.device || 'Consumidor API')))].sort((a, b) => a.localeCompare(b));
    replaceSelectOptions($('methodFilter'), [['all', 'Todos os métodos'], ...methods.map(value => [value, value])]);
    replaceSelectOptions($('appFilter'), [['all', 'Todos os consumidores'], ...apps.map(value => [value, value])]);
  }

  function replaceSelectOptions(select, entries) {
    if (!select) return;
    const previous = select.value || 'all';
    const signature = entries.map(entry => entry.join(':')).join('|');
    if (select.dataset.signature !== signature) {
      select.innerHTML = entries.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
      select.dataset.signature = signature;
    }
    select.value = entries.some(([value]) => value === previous) ? previous : 'all';
  }

  function filteredEvents() {
    const search = String($('feedSearch')?.value || '').trim().toLowerCase();
    const status = $('statusFilter')?.value || 'all';
    const method = $('methodFilter')?.value || 'all';
    const app = $('appFilter')?.value || 'all';
    return state.events.filter(event => {
      const code = Number(event.status || 0);
      if (status === 'success' && !(code >= 200 && code < 400)) return false;
      if (status === 'error' && code < 400) return false;
      if (status === 'slow' && !event.slow && Number(event.latencyMs || 0) < 2500) return false;
      if (status === 'aborted' && !event.aborted && !event.clientClosed && code !== 499) return false;
      if (method !== 'all' && String(event.method || '').toUpperCase() !== method) return false;
      const eventApp = String(event.appName || event.device || 'Consumidor API');
      if (app !== 'all' && eventApp !== app) return false;
      if (!search) return true;
      const haystack = [event.route, event.ticker, event.view, eventApp, event.appChannel, event.sourceStatus, event.cacheStatus, event.requestId, ...(event.queryKeys || [])].join(' ').toLowerCase();
      return haystack.includes(search);
    }).slice(0, state.feedLimit);
  }

  function renderFeed() {
    state.filteredEvents = filteredEvents();
    $('feedCount').textContent = `${formatNumber(state.filteredEvents.length)} de ${formatNumber(state.events.length)} eventos`;
    if (!state.filteredEvents.length) {
      $('eventFeed').innerHTML = `<div class="empty-copy">${state.events.length ? 'Nenhum evento corresponde aos filtros.' : 'Aguardando a primeira resposta externa desta instância.'}</div>`;
      renderEventDetail();
      return;
    }
    $('eventFeed').innerHTML = state.filteredEvents.map(event => {
      const id = eventIdentity(event);
      const selected = id === state.selectedId;
      const tone = statusTone(event.status);
      const source = event.sourceStatus && event.sourceStatus !== 'unknown' ? event.sourceStatus : 'fonte —';
      const cache = event.cacheStatus && event.cacheStatus !== 'unknown' ? event.cacheStatus : 'cache —';
      const flags = [
        event.ticker ? `<span class="flag">${escapeHtml(event.ticker)}</span>` : '',
        `<span class="flag">${escapeHtml(source)}</span>`,
        `<span class="flag">${escapeHtml(cache)}</span>`,
        event.aborted || event.clientClosed ? '<span class="flag danger">cancelada</span>' : event.slow ? '<span class="flag danger">lenta</span>' : '',
      ].filter(Boolean).join('');
      return `<button class="event-row${selected ? ' selected' : ''}" type="button" role="listitem" data-event-id="${escapeHtml(id)}" aria-pressed="${selected}"><time class="event-time" datetime="${escapeHtml(event.at || '')}">${escapeHtml(formatTime(event.at))}</time><span class="event-main"><span class="event-route"><span class="method">${escapeHtml(event.method || 'GET')}</span><strong>${escapeHtml(event.route || '/')}</strong></span><span class="event-consumer">${escapeHtml(`${event.appName || event.device || 'Consumidor API'}${event.appChannel ? ` · ${event.appChannel}` : ''}`)}</span></span><span class="event-delivery"><strong class="status-code ${tone}">${escapeHtml(event.status || '—')}</strong><small>${escapeHtml(`${formatMs(event.latencyMs)} · ${formatBytes(event.bytesOut)}`)}</small><span class="event-flags">${flags}</span></span></button>`;
    }).join('');
    $$('.event-row').forEach(button => button.addEventListener('click', () => {
      state.selectedId = button.dataset.eventId;
      renderFeed();
    }));
    renderEventDetail();
  }

  function selectedEvent() {
    return state.events.find(event => eventIdentity(event) === state.selectedId) || null;
  }

  function renderEventDetail() {
    const event = selectedEvent();
    const copyButton = $('copyEventButton');
    copyButton.disabled = !event;
    if (!event) {
      $('detailTitle').textContent = 'Selecione uma resposta';
      $('eventDetailBody').className = 'empty-copy';
      $('eventDetailBody').textContent = 'O detalhe mostra entrada, saída, origem, cache, contrato e uma prévia limitada do payload entregue.';
      return;
    }
    $('detailTitle').textContent = `${event.method || 'GET'} ${event.status || '—'}`;
    $('eventDetailBody').className = '';
    const queryEntries = Object.entries(event.safeQuery || {});
    const queryText = queryEntries.length ? queryEntries.map(([key, value]) => `${key}=${value}`).join(' · ') : (event.queryKeys || []).join(', ') || 'sem parâmetros visíveis';
    const roots = Array.isArray(event.payloadRoots) ? event.payloadRoots : [];
    const signals = event.payloadSignals && typeof event.payloadSignals === 'object' ? event.payloadSignals : {};
    $('eventDetailBody').innerHTML = `
      <div class="detail-block"><p class="detail-route">${escapeHtml(event.route || '/')}</p><div class="detail-subline"><span>${escapeHtml(formatDateTime(event.at))}</span><span>request ${escapeHtml(event.requestId || 'não informado')}</span><span>${escapeHtml(event.interceptor || 'interceptor —')}</span></div></div>
      <dl class="fact-list">${facts([
        ['Consumidor', event.appName || event.device || 'Consumidor API'],
        ['Canal / versão', [event.appChannel, event.appVersion, event.appBuild].filter(Boolean).join(' · ') || '—'],
        ['Entrada', `${formatBytes(event.bytesIn || 0)} · ${event.requestContentType || 'sem body'}`],
        ['Parâmetros', queryText],
        ['Ticker / view', [event.ticker, event.view].filter(Boolean).join(' · ') || '—'],
        ['Resposta', `${event.status || '—'} · ${event.contentType || 'tipo não informado'}`, Number(event.status || 0) >= 400 ? 'danger' : 'success'],
        ['Latência', formatMs(event.latencyMs), event.slow ? 'warning' : ''],
        ['Saída', formatBytes(event.bytesOut || 0)],
        ['Fonte', event.sourceStatus || 'unknown'],
        ['Cache', event.cacheStatus || 'unknown'],
        ['Entrega', event.deliveryDecision || event.payloadKind || '—'],
        ['Região / host', [event.platform?.region, event.platform?.host].filter(Boolean).join(' · ') || '—'],
      ])}</dl>
      <div class="detail-block"><h3>Raízes entregues</h3><div class="chip-line">${roots.length ? roots.map(root => `<span class="chip">${escapeHtml(root)}</span>`).join('') : '<span class="empty-copy">Nenhuma raiz JSON identificada.</span>'}</div></div>
      <div class="detail-block"><h3>Sinais do contrato</h3><pre>${escapeHtml(JSON.stringify(signals, null, 2) || '{}')}</pre></div>
      <div class="detail-block"><h3>Prévia segura do payload</h3><pre>${escapeHtml(prettyPayload(event.payloadPreview))}</pre></div>`;
  }

  function prettyPayload(payload) {
    if (payload === undefined || payload === null || payload === '') return 'Sem corpo ou prévia indisponível.';
    if (typeof payload !== 'string') return JSON.stringify(payload, null, 2);
    try { return JSON.stringify(JSON.parse(payload), null, 2); } catch { return payload; }
  }

  function renderRoutes() {
    const data = state.data;
    if (!data) return;
    const summary = data.summary || {};
    const routes = Array.isArray(data.routeDetails) ? data.routeDetails : [];
    $('routeMetrics').innerHTML = [
      metric('Rotas observadas', formatNumber(summary.routesTracked || routes.length), 'instância atual'),
      metric('Clientes ativos', formatNumber(summary.activeClients5m || 0), 'últimos 5 minutos'),
      metric('Cache hit', `${formatNumber(summary.cacheHitRatePercent || 0)}%`, `${formatNumber(summary.cacheHits || 0)} hits`),
      metric('Fonte confiável', `${formatNumber(summary.sourceReliabilityScore ?? 100)}/100`, `${formatNumber(summary.blockedSources || 0)} bloqueios`, (summary.sourceReliabilityScore ?? 100) < 80 ? 'warning' : 'success'),
      metric('Entrada', formatBytes(summary.bytesIn || 0), `média ${formatBytes(summary.avgBytesIn || 0)}`),
      metric('Saída', formatBytes(summary.bytesOut || 0), `${formatNumber(summary.responses || 0)} respostas`),
    ].join('');
    renderRouteTable(routes);
    renderDistribution('sourceDistribution', data.distributions?.source || [], 'Nenhuma fonte identificada');
    renderDistribution('cacheDistribution', data.distributions?.cache || [], 'Cache ainda não observado');
    const apps = [...(data.distributions?.apps || []).map(item => ({ ...item, name: `App · ${item.name}` })), ...(data.distributions?.channels || []).map(item => ({ ...item, name: `Canal · ${item.name}` }))];
    renderDistribution('appDistribution', apps, 'Nenhum consumidor identificado');
  }

  function renderRouteTable(routes) {
    const search = String($('routeSearch')?.value || '').trim().toLowerCase();
    const filtered = routes.filter(route => !search || [route.route, route.topSource, route.topCache, route.topApp, route.topChannel].join(' ').toLowerCase().includes(search));
    $('routeCount').textContent = `${formatNumber(filtered.length)} rotas`;
    $('routeTable').innerHTML = filtered.length ? filtered.map(route => `<tr><td>${escapeHtml(route.route || '—')}<span class="cell-sub">${escapeHtml(route.topMethod || 'GET')} · último ${escapeHtml(formatTime(route.lastSeenAt))}</span></td><td><span class="cell-main">${escapeHtml(`${formatNumber(route.responses || 0)} respostas`)}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.requests || 0)} requisições`)}</span></td><td><span class="cell-main ${route.errorRatePercent ? 'tone-danger' : 'tone-success'}">${escapeHtml(`${formatNumber(route.successRatePercent ?? 100)}% sucesso`)}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.errors || 0)} erros`)}</span></td><td><span class="cell-main">p95 ${escapeHtml(formatMs(route.p95LatencyMs))}</span><span class="cell-sub">média ${escapeHtml(formatMs(route.avgLatencyMs))}</span></td><td><span class="cell-main">${escapeHtml(formatBytes(route.avgBytesOut || 0))}</span><span class="cell-sub">${escapeHtml(`${formatNumber(route.deliveredPayloads || 0)} payloads`)}</span></td><td><span class="cell-main">${escapeHtml(route.topSource || route.lastSourceStatus || '—')}</span><span class="cell-sub">${escapeHtml(route.topCache || route.lastCacheStatus || '—')}</span></td><td><span class="cell-main">${escapeHtml(route.topApp || route.topDevice || '—')}</span><span class="cell-sub">${escapeHtml(route.topChannel || 'canal —')}</span></td></tr>`).join('') : '<tr><td colspan="7">Nenhuma rota corresponde ao filtro.</td></tr>';
  }

  function renderDistribution(id, items, emptyMessage) {
    const node = $(id);
    const list = Array.isArray(items) ? items.filter(item => item && Number(item.value || 0) > 0).slice(0, 12) : [];
    if (!list.length) {
      node.innerHTML = `<div class="empty-copy">${escapeHtml(emptyMessage)}</div>`;
      return;
    }
    const max = Math.max(...list.map(item => Number(item.value || 0)), 1);
    node.innerHTML = list.map(item => `<div class="distribution-row"><span title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span><span class="distribution-bar"><i style="width:${Math.max(2, (Number(item.value || 0) / max) * 100)}%"></i></span><strong>${escapeHtml(formatNumber(item.value))}</strong></div>`).join('');
  }

  function renderHealth() {
    const data = state.data;
    if (!data) return;
    const summary = data.summary || {};
    const heap = Number(summary.heapUsagePercent || 0);
    $('healthMetrics').innerHTML = [
      metric('Saúde', `${formatNumber(summary.healthScore ?? 100)}/100`, summary.operationalState || 'aguardando', (summary.healthScore ?? 100) < 75 ? 'danger' : (summary.healthScore ?? 100) < 88 ? 'warning' : 'success'),
      metric('Disponibilidade', `${formatNumber(summary.availabilityPercent ?? 100)}%`, `SLO ${formatNumber(summary.sloAvailabilityTargetPercent || 99)}%`, (summary.availabilityPercent ?? 100) < (summary.sloAvailabilityTargetPercent || 99) ? 'danger' : 'success'),
      metric('Latência p95', formatMs(summary.p95LatencyMs), `alvo ${formatMs(summary.sloP95TargetMs || 2500)}`, (summary.p95LatencyMs || 0) > (summary.sloP95TargetMs || 2500) ? 'warning' : ''),
      metric('Erros 5xx', formatNumber(summary.serverErrors || 0), `${formatNumber(summary.clientErrors || 0)} erros 4xx`, summary.serverErrors ? 'danger' : 'success'),
      metric('Heap', `${formatNumber(heap)}%`, `${formatNumber(summary.heapUsedMb || 0)} de ${formatNumber(summary.heapTotalMb || 0)} MB`, heap > 82 ? 'warning' : ''),
      metric('SLO', String(summary.sloStatus || '—').replaceAll('_', ' '), `${formatNumber(summary.errorBudgetRemainingPercent ?? 100)}% orçamento restante`, (summary.errorBudgetRemainingPercent ?? 100) < 30 ? 'warning' : ''),
    ].join('');
    renderPlainList('alertList', data.insights || [], item => ({ level: item.level, title: item.title, text: item.description }));
    renderPlainList('runbookList', data.operations?.runbook || [], item => ({ level: item.level, title: item.action, text: item.detail }));
    $('captureFacts').innerHTML = facts([
      ['Cobertura', `${formatNumber(summary.captureCompletenessPercent ?? 100)}%`, (summary.captureCompletenessPercent ?? 100) < 99 ? 'warning' : 'success'],
      ['Lacunas', formatNumber(summary.captureGap || 0), summary.captureGap ? 'danger' : 'success'],
      ['sendJson', formatNumber(summary.interceptedBySendJson || 0)],
      ['Diretas / stream', formatNumber(summary.interceptedByResEnd || 0)],
      ['HEAD / bodyless', `${formatNumber(summary.headResponses || 0)} / ${formatNumber(summary.bodylessResponses || 0)}`],
      ['Polling interno', formatNumber(summary.internalTelemetryRequests || 0)],
      ['Eventos retidos', formatNumber(summary.eventsStored || 0)],
    ]);
    const runtime = data.vercelRuntime || {};
    $('runtimeFacts').innerHTML = facts([
      ['Ambiente', runtime.env || data.instance?.platform || 'local'],
      ['Região', runtime.observed?.lastRegion || runtime.region || 'local'],
      ['Host', runtime.observed?.lastHost || runtime.url || '—'],
      ['Node.js', data.instance?.node || '—'],
      ['Uptime', formatAge(data.instance?.uptimeSeconds || 0)],
      ['Instância', data.instance?.id || '—'],
      ['RSS', formatBytes(data.instance?.memory?.rss || 0)],
    ]);
    renderErrors();
    if ($('rawDetails').open) renderRawSnapshot();
  }

  function renderPlainList(id, items, mapper) {
    const node = $(id);
    const list = Array.isArray(items) ? items.slice(0, 10) : [];
    node.innerHTML = list.length ? list.map(raw => {
      const item = mapper(raw);
      const level = item.level === 'error' ? 'error' : item.level === 'warn' ? 'warning' : item.level === 'ok' ? 'ok' : 'info';
      return `<div class="plain-row ${level}"><i aria-hidden="true"></i><div><strong>${escapeHtml(item.title || 'Informação')}</strong><span>${escapeHtml(item.text || '')}</span></div></div>`;
    }).join('') : '<div class="empty-copy">Nenhum sinal disponível.</div>';
  }

  function renderErrors() {
    const errors = state.events.filter(event => Number(event.status || 0) >= 400 || event.aborted || event.clientClosed).slice(0, 40);
    $('errorCount').textContent = formatNumber(errors.length);
    $('errorList').innerHTML = errors.length ? errors.map(event => `<div class="error-row"><time>${escapeHtml(formatTime(event.at))}</time><strong class="tone-${Number(event.status || 0) >= 500 ? 'danger' : 'warning'}">${escapeHtml(event.status || '—')}</strong><code title="${escapeHtml(event.route || '')}">${escapeHtml(event.route || '/')}</code><span>${escapeHtml(event.sourceStatus || event.deliveryDecision || '—')}</span><span>${escapeHtml(formatMs(event.latencyMs))}</span></div>`).join('') : '<div class="empty-copy">Nenhum erro ou cancelamento no feed recente.</div>';
  }

  function drawTrafficChart() {
    const canvas = $('trafficChart');
    if (!canvas || state.view !== 'health') return;
    const data = Array.isArray(state.data?.timeSeries) ? state.data.timeSeries.slice(-60) : [];
    const width = Math.max(320, canvas.clientWidth || 800);
    const height = 190;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext('2d');
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const styles = getComputedStyle(document.body);
    const line = styles.getPropertyValue('--line').trim();
    const muted = styles.getPropertyValue('--muted').trim();
    const accent = styles.getPropertyValue('--accent').trim();
    const success = styles.getPropertyValue('--success').trim();
    const danger = styles.getPropertyValue('--danger').trim();
    if (data.length < 2) {
      context.fillStyle = muted;
      context.font = '12px system-ui';
      context.fillText('Aguardando série temporal suficiente.', 4, 28);
      return;
    }
    const padding = { top: 16, right: 6, bottom: 24, left: 34 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const maximum = Math.max(1, ...data.flatMap(point => [Number(point.requests || 0), Number(point.responses || 0), Number(point.errors || 0)]));
    context.strokeStyle = line;
    context.lineWidth = 1;
    for (let index = 0; index <= 3; index += 1) {
      const y = padding.top + (chartHeight * index / 3);
      context.beginPath(); context.moveTo(padding.left, y); context.lineTo(width - padding.right, y); context.stroke();
    }
    const plot = (key, color) => {
      context.strokeStyle = color;
      context.lineWidth = key === 'errors' ? 1.4 : 1.8;
      context.beginPath();
      data.forEach((point, index) => {
        const x = padding.left + (chartWidth * index / Math.max(1, data.length - 1));
        const y = padding.top + chartHeight - (Number(point[key] || 0) / maximum) * chartHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    plot('requests', accent); plot('responses', success); plot('errors', danger);
    context.fillStyle = muted;
    context.font = '10px system-ui';
    context.fillText(String(maximum), 3, padding.top + 3);
    context.fillText('0', 22, padding.top + chartHeight + 3);
  }

  function renderRawSnapshot() {
    if (!state.data) return;
    const generatedAt = state.data.generatedAt || String(state.lastSuccessAt);
    if (state.rawRenderedAt === generatedAt) return;
    $('rawSnapshot').textContent = JSON.stringify(state.data, null, 2);
    state.rawRenderedAt = generatedAt;
  }

  function renderSettings() {
    if ($('apiBaseInput') && document.activeElement !== $('apiBaseInput')) $('apiBaseInput').value = apiBase();
    if ($('pollInterval')) $('pollInterval').value = String(state.pollMs);
    if ($('feedLimit')) $('feedLimit').value = String(state.feedLimit);
    const summary = state.data?.summary;
    if ($('settingsState')) $('settingsState').textContent = `${apiBase() || location.origin} · ${state.paused ? 'polling pausado' : `atualização a cada ${state.pollMs / 1000}s`} · ${formatNumber(summary?.eventsStored || state.events.length)} eventos no servidor.`;
    renderThemeChoices();
  }

  function setView(rawView, { updateHash = true } = {}) {
    const candidate = VIEW_ALIASES[rawView] || rawView || 'live';
    const view = ['live', 'routes', 'health', 'settings'].includes(candidate) ? candidate : 'live';
    state.view = view;
    $$('[data-view]').forEach(button => button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'));
    $$('[data-view-panel]').forEach(panel => {
      const active = panel.dataset.viewPanel === view;
      panel.hidden = !active;
      panel.classList.toggle('active', active);
    });
    safeStorage.set(STORAGE.view, view);
    if (updateHash) history.replaceState(null, '', `#${view}`);
    if (view === 'health') requestAnimationFrame(drawTrafficChart);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function themeMode() {
    return safeStorage.get(STORAGE.theme, 'system');
  }

  function applyTheme(mode = themeMode()) {
    const normalized = ['dark', 'light', 'system'].includes(mode) ? mode : 'system';
    safeStorage.set(STORAGE.theme, normalized);
    const resolved = normalized === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : normalized;
    document.body.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    renderThemeChoices();
    if (state.view === 'health') requestAnimationFrame(drawTrafficChart);
  }

  function renderThemeChoices() {
    const mode = themeMode();
    $$('[data-theme]').forEach(button => button.classList.toggle('active', button.dataset.theme === mode));
  }

  function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function csvValue(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function exportEvents(format) {
    const events = state.filteredEvents.length ? state.filteredEvents : state.events.slice(0, state.feedLimit);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (format === 'json') {
      downloadFile(`valorae-proxy-events-${stamp}.json`, JSON.stringify({ releasePatch: state.data?.releasePatch || RELEASE_PATCH, generatedAt: new Date().toISOString(), events }, null, 2), 'application/json');
    } else {
      const columns = ['at', 'method', 'route', 'status', 'latencyMs', 'bytesIn', 'bytesOut', 'appName', 'appChannel', 'ticker', 'view', 'cacheStatus', 'sourceStatus', 'requestId'];
      const csv = [columns.join(','), ...events.map(event => columns.map(column => csvValue(event[column])).join(','))].join('\n');
      downloadFile(`valorae-proxy-events-${stamp}.csv`, csv, 'text/csv;charset=utf-8');
    }
  }

  async function copyText(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      toast('Não foi possível copiar neste navegador.');
    }
  }

  function bindEvents() {
    $$('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    $('refreshButton').addEventListener('click', () => refresh({ manual: true }));
    $('pauseButton').addEventListener('click', () => {
      state.paused = !state.paused;
      $('pauseButton').textContent = state.paused ? 'Retomar' : 'Pausar';
      if (state.paused) {
        clearTimeout(state.timer);
        state.requestController?.abort();
        setConnection('stale', 'Pausado');
      } else {
        refresh({ manual: true });
      }
      renderSettings();
    });
    $('themeToggle').addEventListener('click', () => applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'));
    $$('[data-theme]').forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.theme)));
    for (const id of ['feedSearch', 'statusFilter', 'methodFilter', 'appFilter']) {
      $(id).addEventListener(id === 'feedSearch' ? 'input' : 'change', renderFeed);
    }
    $('clearFilters').addEventListener('click', () => {
      $('feedSearch').value = '';
      $('statusFilter').value = 'all';
      $('methodFilter').value = 'all';
      $('appFilter').value = 'all';
      renderFeed();
    });
    $('routeSearch').addEventListener('input', () => renderRouteTable(state.data?.routeDetails || []));
    $('copyEventButton').addEventListener('click', () => {
      const event = selectedEvent();
      if (event) copyText(JSON.stringify(event, null, 2), 'Evento copiado.');
    });
    $('exportJsonButton').addEventListener('click', () => exportEvents('json'));
    $('exportCsvButton').addEventListener('click', () => exportEvents('csv'));
    $('rawDetails').addEventListener('toggle', () => { if ($('rawDetails').open) renderRawSnapshot(); });
    $('copySnapshotButton').addEventListener('click', () => state.data && copyText(JSON.stringify(state.data, null, 2), 'Snapshot copiado.'));
    $('pollInterval').addEventListener('change', () => {
      state.pollMs = boundedNumber($('pollInterval').value, 3000, 2000, 10000);
      safeStorage.set(STORAGE.poll, String(state.pollMs));
      schedule();
      renderSettings();
    });
    $('feedLimit').addEventListener('change', () => {
      state.feedLimit = boundedNumber($('feedLimit').value, 60, 30, 80);
      safeStorage.set(STORAGE.feedLimit, String(state.feedLimit));
      renderFeed();
      renderSettings();
    });
    $('saveApiBase').addEventListener('click', () => {
      const raw = String($('apiBaseInput').value || '').trim().replace(/\/$/, '');
      if (raw && !/^https?:\/\//i.test(raw)) {
        toast('Informe uma URL iniciada por http:// ou https://.');
        return;
      }
      safeStorage.set(STORAGE.apiBase, raw);
      state.data = null;
      state.events = [];
      toast('Origem atualizada.');
      refresh({ manual: true });
    });
    $('clearApiBase').addEventListener('click', () => {
      safeStorage.remove(STORAGE.apiBase);
      $('apiBaseInput').value = '';
      state.data = null;
      state.events = [];
      toast('Monitorando a origem atual.');
      refresh({ manual: true });
    });
    $('resetPreferences').addEventListener('click', () => {
      Object.values(STORAGE).forEach(key => safeStorage.remove(key));
      state.pollMs = 3000;
      state.feedLimit = 60;
      applyTheme('system');
      setView('live');
      renderSettings();
      toast('Preferências restauradas.');
      refresh({ manual: true });
    });
    window.addEventListener('hashchange', () => setView(location.hash.slice(1), { updateHash: false }));
    window.addEventListener('resize', () => { if (state.view === 'health') requestAnimationFrame(drawTrafficChart); });
    window.addEventListener('online', () => refresh({ manual: true }));
    window.addEventListener('offline', () => setConnection('offline', 'Sem rede'));
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !state.paused) refresh({ manual: true }); });
    matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (themeMode() === 'system') applyTheme('system'); });
  }

  function init() {
    applyTheme(themeMode());
    bindEvents();
    $('pollInterval').value = String(state.pollMs);
    $('feedLimit').value = String(state.feedLimit);
    const initial = VIEW_ALIASES[location.hash.slice(1)] || location.hash.slice(1) || safeStorage.get(STORAGE.view, 'live');
    setView(initial, { updateHash: false });
    renderSettings();
    refresh({ manual: true });
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  }

  init();
})();
