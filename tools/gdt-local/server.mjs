import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const portal = 'https://hoadondientu.gdt.gov.vn';
const files = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'] };
const fail = (status, message) => Object.assign(new Error(message), { status });

// Fixed-origin transport. Credentials never enter a command line or a log.
export function portalRequest(path, { method = 'GET', body, token, cookies, extraHeaders } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: 'application/json', 'Accept-Language': 'vi', Origin: portal, Referer: portal + '/', 'User-Agent': 'Mozilla/5.0 GdtLocalDiscovery/1.0', 'request-id': randomUUID(), 'End-Point': path.startsWith('/api/query/') ? '/tra-cuu/tra-cuu-hoa-don' : '/', Action: '' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);
    if (cookies?.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    const req = https.request(portal + path, { method, headers }, res => {
      for (const line of res.headers['set-cookie'] || []) {
        const pair = line.split(';', 1)[0]; const at = pair.indexOf('=');
        if (at > 0) cookies?.set(pair.slice(0, at), pair.slice(at + 1));
      }
      const chunks = []; let length = 0;
      res.on('data', chunk => { length += chunk.length; if (length > 8_000_000) { res.destroy(); reject(fail(502, 'Portal response exceeds the discovery limit.')); } else chunks.push(chunk); });
      res.on('error', () => reject(fail(502, 'Portal connection interrupted.')));
      res.on('end', () => {
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { resolve({ status: res.statusCode, data: { _binary: Buffer.concat(chunks).toString('base64'), contentType: res.headers['content-type'] || 'application/octet-stream' } }); return; }
        resolve({ status: res.statusCode, data });
      });
    });
    req.setTimeout(25000, () => req.destroy());
    req.on('error', () => reject(fail(502, 'Cannot reach the tax portal. Please retry.')));
    req.end(payload);
  });
}
export function portalBlob(path, { token, cookies } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { Accept: '*/*', 'Accept-Language': 'vi', Origin: portal, Referer: portal + '/', 'User-Agent': 'Mozilla/5.0 GdtLocalDiscovery/1.0', 'request-id': randomUUID(), 'End-Point': '/tra-cuu/tra-cuu-hoa-don' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (cookies?.size) headers.Cookie = [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    const req = https.request(portal + path, { method: 'GET', headers }, res => {
      const chunks = []; let length = 0;
      res.on('data', chunk => { length += chunk.length; if (length > 80_000_000) { res.destroy(); reject(fail(502, 'Download exceeds the safety limit.')); } else chunks.push(chunk); });
      res.on('error', () => reject(fail(502, 'Portal download interrupted.')));
      res.on('end', () => resolve({ status: res.statusCode, contentType: res.headers['content-type'] || 'application/octet-stream', bytes: Buffer.concat(chunks) }));
    });
    req.setTimeout(60000, () => req.destroy()); req.on('error', () => reject(fail(502, 'Cannot download from the tax portal.'))); req.end();
  });
}

function check(result, stage = 'request') {
  if (result.status >= 200 && result.status < 300) return result.data;
  // Never relay arbitrary upstream bodies: they can echo credentials.
  throw Object.assign(fail(result.status === 401 ? 401 : 502, `Portal rejected ${stage} (HTTP ${result.status}). No automatic retry was made. ${stage === 'authentication' ? 'Refresh CAPTCHA and check your login, or use the official portal browser.' : 'The portal session or access permissions could not be verified.'}`), { stage, upstreamStatus: result.status });
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(400, 'Choose valid dates.');
  const ms = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) throw fail(400, 'Invalid calendar date.');
  return ms;
}
function isoDay(ms) { return new Date(ms).toISOString().slice(0, 10); }
function bulkWindows(from, to) {
  const start = date(from), end = date(to);
  if (end < start) throw fail(400, 'End date must not be before start date.');
  if (end - start > 366 * 86400000) throw fail(400, 'Bulk discovery is limited to one year per job.');
  const windows = [];
  for (let cursor = start; cursor <= end; cursor += 30 * 86400000) {
    const last = Math.min(end, cursor + 29 * 86400000);
    windows.push({ from: isoDay(cursor), to: isoDay(last) });
  }
  return windows;
}
export function invoicePath(input, source = 'query') {
  const from = date(input.from), to = date(input.to);
  // The tax portal accepts at most 30 calendar days, inclusive of both dates.
  if (to < from || to - from > 29 * 86400000) throw fail(400, 'The tax portal accepts at most 30 calendar days per query.');
  if (!['purchase', 'sold'].includes(input.direction)) throw fail(400, 'Invalid direction.');
  if (!['query', 'sco-query'].includes(source)) throw fail(400, 'Invalid invoice source.');
  const fmt = d => d.split('-').reverse().join('/');
  const q = new URLSearchParams({ sort: 'tdlap:desc', size: '15', search: `tdlap=ge=${fmt(input.from)}T00:00:00;tdlap=le=${fmt(input.to)}T23:59:59` });
  if (input.state) {
    if (typeof input.state !== 'string' || input.state.length > 4096) throw fail(400, 'Invalid cursor.');
    q.set('state', input.state);
  }
  return `/api/${source}/invoices/${input.direction}?${q}`;
}
async function jsonBody(req) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > 16384) throw fail(413, 'Request too large.'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fail(400, 'Invalid JSON.'); }
}

// One operator on one workstation. No production accounts/database are modified.
export function createApp(upstream = portalRequest, options = {}) {
  const onlineOrigins = new Set(options.onlineOrigins || (options.onlineOrigin ? [options.onlineOrigin] : ['https://anhmedia.vn', 'https://anhmedia.vn:8443']));
  const primaryOnlineOrigin = options.onlineOrigin || [...onlineOrigins][0];
  const pairingToken = options.pairingToken || randomUUID();
  let token = '', profile = null, expires = 0, busy = false, lastFailure = null;
  let cookies = new Map();
  const challenges = new Map();
  const clear = () => { token = ''; profile = null; expires = 0; challenges.clear(); cookies.clear(); };
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    let locked = false;
    try {
      const authority = `127.0.0.1:${req.socket.localPort}`;
      const localOrigin = `http://${authority}`;
      if (req.headers.host !== authority) throw fail(403, 'Open this page using 127.0.0.1.');
      const requestOrigin = req.headers.origin;
      const online = onlineOrigins.has(requestOrigin);
      if (req.headers.origin && req.headers.origin !== localOrigin && !online) throw fail(403, 'Cross-origin request rejected.');
      if (online) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-GDT-Local, X-GDT-Pairing');
        if (req.headers['access-control-request-private-network'] === 'true') res.setHeader('Access-Control-Allow-Private-Network', 'true');
      }
      if (req.method === 'OPTIONS') { if (!online) throw fail(403, 'Cross-origin request rejected.'); res.writeHead(204); res.end(); return; }
      const url = new URL(req.url, `http://${authority}`);
      const safeNavigation = req.method === 'GET' && Boolean(files[url.pathname]) && !req.headers.origin;
      if (req.headers['sec-fetch-site'] === 'cross-site' && !online && !safeNavigation) throw fail(403, 'Cross-site request rejected.');
      if (files[url.pathname] && req.method === 'GET') {
        const [name, type] = files[url.pathname];
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
        res.end(await readFile(new URL(name, import.meta.url))); return;
      }
      if (req.headers['x-gdt-local'] !== '1') throw fail(403, 'Local client header required.');
      if (online && req.headers['x-gdt-pairing'] !== pairingToken) throw fail(403, 'Pair this browser with the local GDT helper again.');
      if (url.pathname === '/api/pairing' && req.method === 'GET') {
        if (online) throw fail(403, 'Pairing details are available only on the local page.');
        send(200, { token: pairingToken, onlineUrl: `${primaryOnlineOrigin}/bom-inventory/invoice-desk#gdt-pair=${encodeURIComponent(pairingToken)}` }); return;
      }
      if (expires && Date.now() > expires) clear();
      if (url.pathname === '/api/status' && req.method === 'GET') { send(200, { authenticated: Boolean(token && profile), profile, expiresAt: expires || null, lastFailure }); return; }
      if (req.method !== 'POST' || !['/api/captcha', '/api/sco-captcha', '/api/login', '/api/disconnect', '/api/invoices', '/api/sco-invoices', '/api/bulk', '/api/detail', '/api/export', '/api/sco-export', '/api/xml', '/api/pdf'].includes(url.pathname)) throw fail(404, 'Not found.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw fail(415, 'JSON required.');
      if (busy) throw fail(409, 'Another request is running.');
      busy = true; locked = true;
      const input = await jsonBody(req);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail(400, 'JSON object required.');
      if (url.pathname === '/api/disconnect') { clear(); send(200, { disconnected: true }); return; }
      if (url.pathname === '/api/captcha') {
        for (const [id, c] of challenges) if (Date.now() - c.time > 120000) challenges.delete(id);
        if (challenges.size >= 20) challenges.delete(challenges.keys().next().value);
        const challengeCookies = new Map();
        const c = check(await upstream('/api/captcha', { cookies: challengeCookies }), 'CAPTCHA retrieval');
        if (typeof c.key !== 'string' || typeof c.content !== 'string' || !c.content.trim().startsWith('<svg')) throw fail(502, 'Unexpected CAPTCHA format.');
        const challengeId = randomUUID();
        challenges.set(challengeId, { key: c.key, time: Date.now(), cookies: challengeCookies, kind: 'login' });
        send(200, { challengeId, image: 'data:image/svg+xml;base64,' + Buffer.from(c.content).toString('base64') }); return;
      }
      if (url.pathname === '/api/login') {
        if (token) throw fail(409, 'Disconnect before switching accounts.');
        const challenge = challenges.get(input.challengeId);
        if (!challenge || challenge.kind !== 'login' || Date.now() - challenge.time > 120000) throw fail(400, 'Refresh CAPTCHA and try again.');
        for (const key of ['username', 'password', 'cvalue']) if (typeof input[key] !== 'string' || !input[key] || input[key].length > 256) throw fail(400, 'Enter username, password and CAPTCHA.');
        const key = challenge.key; challenges.delete(input.challengeId); cookies = challenge.cookies;
        try {
          const auth = check(await upstream('/api/security-taxpayer/authenticate', { method: 'POST', cookies, body: { username: input.username.trim(), password: input.password, cvalue: input.cvalue.trim(), ckey: key } }), 'authentication');
          input.password = '';
          if (typeof auth.token !== 'string' || !auth.token) throw fail(502, 'Unexpected authentication response.');
          const info = check(await upstream('/api/security-taxpayer/profile', { cookies, token: auth.token }), 'profile verification');
          if (!info || typeof info !== 'object' || Array.isArray(info)) throw fail(502, 'Unexpected profile response.');
          // Whitelist display fields; never expose tokens or the complete account profile.
          profile = Object.fromEntries(['username', 'mst', 'name', 'ten', 'groupId', 'type'].filter(k => ['string', 'number'].includes(typeof info[k])).map(k => [k, info[k]]));
          token = auth.token; expires = Date.now() + 30 * 60 * 1000;
          challenges.clear(); lastFailure = null;
          send(200, { authenticated: true, profile, expiresAt: expires });
        } catch (e) { clear(); throw e; } finally { input.password = ''; }
        return;
      }
      if (!token || !profile) throw fail(401, 'Sign in first.');
      if (url.pathname === '/api/sco-captcha') {
        for (const [id, c] of challenges) if (Date.now() - c.time > 120000) challenges.delete(id);
        if (challenges.size >= 20) challenges.delete(challenges.keys().next().value);
        const c = check(await upstream('/api/captcha', { cookies, token }), 'cash-register CAPTCHA retrieval');
        if (typeof c.key !== 'string' || typeof c.content !== 'string' || !c.content.trim().startsWith('<svg')) throw fail(502, 'Unexpected CAPTCHA format.');
        const challengeId = randomUUID();
        challenges.set(challengeId, { key: c.key, time: Date.now(), kind: 'sco' });
        send(200, { challengeId, image: 'data:image/svg+xml;base64,' + Buffer.from(c.content).toString('base64'), expiresAt: Date.now() + 120000 }); return;
      }
      if (url.pathname === '/api/sco-invoices' || url.pathname === '/api/sco-export') {
        const challenge = challenges.get(input.challengeId);
        if (!challenge || challenge.kind !== 'sco' || Date.now() - challenge.time > 120000 || typeof input.cvalue !== 'string' || !/^[A-Za-z0-9]+$/.test(input.cvalue.trim()) || input.cvalue.length > 32) throw fail(400, 'Enter a fresh cash-register CAPTCHA.');
        const proof = { ckey: challenge.key, cvalue: input.cvalue.trim() };
        let path = invoicePath(input, 'sco-query');
        const parsed = new URL(path, portal);
        parsed.searchParams.set('ckey', proof.ckey); parsed.searchParams.set('cvalue', proof.cvalue);
        path = parsed.pathname + parsed.search;
        if (url.pathname === '/api/sco-export') path = path.replace('/invoices/' + input.direction, `/invoices/export-excel${input.direction === 'sold' ? '-sold' : ''}`).replace(/&size=15/, '').replace(/&state=[^&]+/, '');
        const result = await upstream(path, { cookies, token, extraHeaders: proof });
        if (result.status === 401) { clear(); throw fail(401, 'Portal session expired. Sign in again.'); }
        if (result.status < 200 || result.status >= 300) { challenges.delete(input.challengeId); throw fail(400, 'The tax portal rejected or consumed this cash-register CAPTCHA. Refresh it and try again.'); }
        if (url.pathname === '/api/sco-export') {
          if (!result.data?._binary) throw fail(502, 'Portal did not return a cash-register Excel file.');
          send(200, { filename: `gdt-cash-register-${input.direction}-${input.from}-${input.to}.xlsx`, contentType: result.data.contentType, data: result.data._binary, captchaReusableUntil: challenge.time + 120000 }); return;
        }
        if (!Array.isArray(result.data?.datas)) throw fail(502, 'Unexpected cash-register invoice response.');
        send(200, { datas: result.data.datas, total: result.data.total, state: result.data.state ?? null, time: result.data.time, direction: input.direction, source: 'sco-query', captchaReusableUntil: challenge.time + 120000 }); return;
      }
      if (url.pathname === '/api/bulk') {
        const windows = bulkWindows(input.from, input.to);
        if (!['purchase', 'sold', 'both'].includes(input.direction)) throw fail(400, 'Invalid direction.');
        const byId = new Map(); const windowCounts = [];
        for (const direction of input.direction === 'both' ? ['purchase', 'sold'] : [input.direction]) for (const window of windows) {
          let state = null; let pages = 0; let seenStates = new Set(); let count = 0;
          do {
            const result = await upstream(invoicePath({ ...window, direction, state }), { cookies, token });
            if (result.status === 401 || result.status === 403) { clear(); throw fail(401, 'Portal session expired during bulk retrieval. Sign in again.'); }
            const data = check(result, 'bulk invoice query');
            if (!Array.isArray(data?.datas)) throw fail(502, 'Unexpected bulk invoice response.');
            for (const invoice of data.datas) {
              const id = `${direction}|${invoice.id || `${invoice.nbmst}|${invoice.khhdon}|${invoice.khmshdon}|${invoice.shdon}`}`;
              if (!byId.has(id)) byId.set(id, { ...invoice, _direction: direction });
            }
            count += data.datas.length; pages += 1;
            const next = data.state || null;
            if (Number.isInteger(data.total) && count === data.total) { state = null; break; }
            if (!next) { if (data.total !== undefined && count !== Number(data.total)) throw fail(502, 'Incomplete bulk query: portal count mismatch.'); state = null; break; }
            if (next === state || seenStates.has(next) || pages >= 1000 || !data.datas.length) throw fail(502, 'Incomplete bulk query: pagination did not finish.');
            seenStates.add(next); state = next;
          } while (state);
          windowCounts.push({ ...window, direction, pages, records: count });
        }
        send(200, { direction: input.direction, from: input.from, to: input.to, windows: windowCounts, total: byId.size, datas: [...byId.values()] }); return;
      }
      if (url.pathname === '/api/detail') {
        for (const k of ['nbmst', 'khmshdon', 'khhdon', 'shdon']) if (input[k] === undefined || input[k] === null || String(input[k]).length > 80) throw fail(400, 'Invoice identity is incomplete.');
        const source = input.source === 'cash' ? 'sco-query' : 'query';
        const detailPath = `/api/${source}/invoices/detail?nbmst=${encodeURIComponent(input.nbmst)}&khmshdon=${encodeURIComponent(input.khmshdon)}&khhdon=${encodeURIComponent(input.khhdon)}&shdon=${encodeURIComponent(input.shdon)}`;
        const detail = check(await upstream(detailPath, { cookies, token }), 'invoice detail');
        send(200, detail); return;
      }
      if (url.pathname === '/api/xml' || url.pathname === '/api/pdf') {
        if (!['purchase', 'sold'].includes(input.direction)) throw fail(400, 'XML export supports one direction at a time.');
        for (const k of ['nbmst', 'khmshdon', 'khhdon', 'shdon']) if (input[k] === undefined || input[k] === null || String(input[k]).length > 80) throw fail(400, 'Invoice identity is incomplete.');
        const source = input.source === 'cash' ? 'sco-query' : 'query';
        const path = `/api/${source}/invoices/export-xml?nbmst=${encodeURIComponent(input.nbmst)}&khmshdon=${encodeURIComponent(input.khmshdon)}&khhdon=${encodeURIComponent(input.khhdon)}&shdon=${encodeURIComponent(input.shdon)}`;
        const result = await upstream(path, { cookies, token });
        const data = check(result, 'XML export');
        if (!data?._binary) throw fail(502, 'Portal did not return an XML archive.');
        if (url.pathname === '/api/pdf') {
          const { renderPdf } = await import('./pdf.mjs');
          const pdf = await renderPdf(Buffer.from(data._binary, 'base64'));
          send(200, { filename: `invoice-${input.khhdon}-${input.shdon}.pdf`, contentType: 'application/pdf', data: pdf.toString('base64') }); return;
        }
        send(200, { filename: `invoice-${input.khhdon}-${input.shdon}.zip`, contentType: data.contentType, data: data._binary }); return;
      }
      if (url.pathname === '/api/export') {
        const path = invoicePath(input).replace('/invoices/' + input.direction, `/invoices/export-excel${input.direction === 'sold' ? '-sold' : ''}`).replace(/&size=15/, '').replace(/&state=[^&]+/, '');
        const result = await upstream(path, { cookies, token });
        const data = check(result, 'Excel export');
        if (!data?._binary) throw fail(502, 'Portal did not return an Excel file.');
        send(200, { filename: `gdt-${input.direction}-${input.from}-${input.to}.xlsx`, contentType: data.contentType, data: data._binary }); return;
      }
      const path = invoicePath(input);
      const result = await upstream(path, { cookies, token });
      if (result.status === 401 || result.status === 403) { clear(); throw fail(401, 'Portal session expired or access denied. Sign in again.'); }
      const data = check(result);
      if (!Array.isArray(data?.datas)) throw fail(502, 'Unexpected invoice response; discovery needs an adapter update.');
      send(200, { datas: data.datas, total: data.total, state: data.state ?? null, time: data.time, direction: input.direction });
    } catch (e) { if (e.stage) lastFailure = { stage: e.stage, status: e.upstreamStatus, at: new Date().toISOString() }; if (!res.headersSent) send(e.status || 500, { message: e.status ? e.message : 'Local request failed.' }); else res.end(); }
    finally { if (locked) busy = false; }
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.GDT_LOCAL_PORT || 8765);
  const server = createApp();
  server.listen(port, '127.0.0.1', () => console.log(`GDT local discovery ready: http://127.0.0.1:${port}`));
  server.on('error', e => { console.error(`Server failed: ${e.code || 'unknown'}`); process.exitCode = 1; });
}
