export const VALORAE_NEXT_FLIGHT_DISCOVERY_VERSION = '2026.07.23-next-flight-safe-static-v1';

function balancedLiteral(source = '', startIndex = 0) {
  const open = source[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : '';
  if (!close) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
  }
  return '';
}

function safeJson(raw = '', maxBytes = 350_000) {
  const source = String(raw || '').trim();
  if (!source || Buffer.byteLength(source, 'utf8') > maxBytes) return null;
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function extractJsonRecords(payload = '', { maxRecords = 24, maxDocumentBytes = 350_000 } = {}) {
  const source = String(payload || '');
  const records = [];
  const recordPattern = /(?:^|\n)([0-9a-f]+):\s*([\[{])/gi;
  let match;
  while ((match = recordPattern.exec(source)) && records.length < maxRecords) {
    const start = match.index + match[0].lastIndexOf(match[2]);
    const raw = balancedLiteral(source, start);
    if (!raw) continue;
    const data = safeJson(raw, maxDocumentBytes);
    if (data) {
      records.push({
        id: `next-flight-json-${match[1]}-${records.length + 1}`,
        kind: 'next-flight-json',
        source: 'next-app-router-rsc',
        framework: 'nextjs-app-router',
        data,
        bytes: Buffer.byteLength(raw, 'utf8'),
      });
    }
    recordPattern.lastIndex = Math.max(recordPattern.lastIndex, start + Math.max(raw.length, 1));
  }
  return records;
}

/**
 * Extracts self.__next_f.push([...]) frames without evaluating page JavaScript.
 * The frame itself is strict JSON. JSON records embedded in the React Flight
 * payload are promoted as separate documents only when they also parse as
 * strict JSON, so protocol references and executable expressions are ignored.
 */
export function extractNextFlightDocuments(scriptText = '', {
  maxFrames = 32,
  maxRecords = 48,
  maxDocumentBytes = 350_000,
} = {}) {
  const source = String(scriptText || '');
  const documents = [];
  const pattern = /(?:self\.)?__next_f\.push\s*\(/g;
  let match;
  let recordCount = 0;
  while ((match = pattern.exec(source)) && documents.length < maxFrames + maxRecords) {
    let start = pattern.lastIndex;
    while (/\s/.test(source[start] || '')) start += 1;
    if (source[start] !== '[') continue;
    const raw = balancedLiteral(source, start);
    if (!raw || Buffer.byteLength(raw, 'utf8') > maxDocumentBytes) continue;
    const frame = safeJson(raw, maxDocumentBytes);
    if (!Array.isArray(frame)) continue;
    const frameNumber = Number.isFinite(Number(frame[0])) ? Number(frame[0]) : documents.length + 1;
    const payload = typeof frame[1] === 'string' ? frame[1] : '';
    const records = payload && recordCount < maxRecords
      ? extractJsonRecords(payload, {
          maxRecords: maxRecords - recordCount,
          maxDocumentBytes,
        })
      : [];
    documents.push({
      id: `next-flight-frame-${frameNumber}-${documents.length + 1}`,
      kind: 'next-flight-frame',
      source: 'self.__next_f.push',
      framework: 'nextjs-app-router',
      // O protocolo Flight pode conter referências e strings não JSON. Guardamos
      // somente metadados do frame; apenas registros JSON estritos são expostos
      // como documentos selecionáveis abaixo.
      data: {
        channel: frameNumber,
        payloadBytes: Buffer.byteLength(payload, 'utf8'),
        strictJsonRecords: records.length,
      },
      bytes: Buffer.byteLength(raw, 'utf8'),
    });
    documents.push(...records);
    recordCount += records.length;
    pattern.lastIndex = Math.max(pattern.lastIndex, start + Math.max(raw.length, 1));
  }
  return documents.slice(0, maxFrames + maxRecords);
}

export const _test = { balancedLiteral, safeJson, extractJsonRecords };
