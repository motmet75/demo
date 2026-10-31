import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, invoicePath } from './server.mjs';

async function fixture(t, upstream) {
  const server = createApp(upstream);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body, headers = {}) => {
    const r = await fetch(base + '/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-GDT-Local': '1', 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  };
  return { call, base };
}

async function bulkFixture(t, queryResponse) {
  const f = await fixture(t, async path => {
    if (path === '/api/captcha') return {status:200,data:{key:'k',content:'<svg></svg>'}};
    if (path.endsWith('/authenticate')) return {status:200,data:{token:'test-token'}};
    if (path.endsWith('/profile')) return {status:200,data:{username:'test'}};
    return {status:200,data:queryResponse(path)};
  });
  const captcha = await f.call('captcha',{});
  await f.call('login',{username:'test',password:'test',cvalue:'test',challengeId:captcha.data.challengeId});
  return f;
}

test('bulk preserves the same invoice in both directions and uses <=30-day windows', async t => {
  const paths=[];
  const {call}=await bulkFixture(t,path=>{paths.push(path);return {datas:[{id:'same',shdon:1}],total:1,state:'terminal-cursor'};});
  const r=await call('bulk',{direction:'both',from:'2026-07-01',to:'2026-09-30'});
  assert.equal(r.status,200); assert.equal(r.data.total,2); assert.equal(paths.length,8);
  assert.equal(r.data.windows[0].to,'2026-07-30');
  assert.equal(r.data.windows[1].from,'2026-07-31');
  assert.equal(r.data.windows[3].to,'2026-09-30');
});

test('bulk refuses incomplete pagination instead of claiming success', async t => {
  const {call}=await bulkFixture(t,()=>({datas:[{id:'one'}],total:10,state:'repeated'}));
  const r=await call('bulk',{direction:'sold',from:'2026-07-01',to:'2026-07-30'});
  assert.equal(r.status,502); assert.match(r.data.message,/Incomplete bulk query/);
});

test('cash-register search forwards one manual CAPTCHA and reuses it while accepted', async t => {
  const calls=[];
  const {call}=await fixture(t,async (path,options)=>{
    calls.push({path,headers:options.extraHeaders});
    if(path==='/api/captcha') return {status:200,data:{key:'cash-key',content:'<svg></svg>'}};
    if(path.endsWith('/authenticate')) return {status:200,data:{token:'token'}};
    if(path.endsWith('/profile')) return {status:200,data:{username:'test'}};
    return {status:200,data:{datas:[{id:'cash-1'}],total:1,state:null}};
  });
  let c=await call('captcha',{});
  await call('login',{username:'test',password:'test',cvalue:'abc',challengeId:c.data.challengeId});
  c=await call('sco-captcha',{});
  const body={direction:'purchase',from:'2026-07-01',to:'2026-07-30',challengeId:c.data.challengeId,cvalue:'Ab12'};
  assert.equal((await call('sco-invoices',body)).status,200);
  assert.equal((await call('sco-invoices',body)).status,200);
  const searches=calls.filter(x=>x.path.startsWith('/api/sco-query/invoices/purchase'));
  assert.equal(searches.length,2);
  for(const x of searches){assert.match(x.path,/ckey=cash-key/);assert.match(x.path,/cvalue=Ab12/);assert.deepEqual(x.headers,{ckey:'cash-key',cvalue:'Ab12'});}
});

test('cash-register CAPTCHA rejects unsafe values before portal request', async t => {
  let requests=0;
  const {call}=await fixture(t,async (path)=>{
    if(path==='/api/captcha') return {status:200,data:{key:'key',content:'<svg></svg>'}};
    if(path.endsWith('/authenticate')) return {status:200,data:{token:'token'}};
    if(path.endsWith('/profile')) return {status:200,data:{username:'test'}};
    requests++; return {status:200,data:{datas:[],total:0,state:null}};
  });
  let c=await call('captcha',{}); await call('login',{username:'test',password:'test',cvalue:'abc',challengeId:c.data.challengeId});
  c=await call('sco-captcha',{});
  const r=await call('sco-invoices',{direction:'sold',from:'2026-07-01',to:'2026-07-30',challengeId:c.data.challengeId,cvalue:'bad\r\nvalue'});
  assert.equal(r.status,400); assert.equal(requests,0);
});
test('login sends exact CAPTCHA binding, verifies profile and keeps token out of responses', async t => {
  const calls = [];
  const { call } = await fixture(t, async (path, options) => {
    calls.push({ path, body: options.body ? { ...options.body } : undefined, token: options.token });
    if (path === '/api/captcha') return { status: 200, data: { key: 'challenge', content: '<svg></svg>' } };
    if (path.endsWith('/authenticate')) return { status: 200, data: { token: 'private-token' } };
    if (path.endsWith('/profile')) return { status: 200, data: { username: 'test', mst: '123', token: 'private-token', password: 'secret' } };
    return { status: 200, data: { datas: [{ shdon: 1 }], total: 1, state: null } };
  });
  assert.equal((await call('invoices', { from: '2026-10-01', to: '2026-10-02', direction: 'purchase' })).status, 401);
  const challengeId = (await call('captcha', {})).data.challengeId;
  const result = await call('login', { username: 'test', password: 'sample-password', cvalue: 'abc', challengeId });
  assert.equal(result.status, 200);
  assert.deepEqual(calls[1].body, { username: 'test', password: 'sample-password', cvalue: 'abc', ckey: 'challenge' });
  assert.equal(calls[2].token, 'private-token');
  assert.deepEqual(result.data.profile, { username: 'test', mst: '123' });
  assert.equal(JSON.stringify(await call('status')).includes('private-token'), false);
  const invoices = await call('invoices', { from: '2026-10-01', to: '2026-10-02', direction: 'purchase' });
  assert.equal(invoices.data.datas.length, 1);
  assert.equal(calls.at(-1).token, 'private-token');
  await call('disconnect', {});
  assert.equal((await call('status')).data.authenticated, false);
});
test('login failures do not echo upstream credentials and consume the challenge', async t => {
  let attempts = 0;
  const { call } = await fixture(t, async path => path === '/api/captcha'
    ? { status: 200, data: { key: 'challenge', content: '<svg></svg>' } }
    : (attempts++, { status: 401, data: { message: 'password=SECRET' } }));
  const challengeId = (await call('captcha', {})).data.challengeId;
  const body = { username: 'test', password: 'SECRET', cvalue: 'abc', challengeId };
  const result = await call('login', body);
  assert.equal(result.status, 401);
  assert.equal(JSON.stringify(result).includes('SECRET'), false);
  assert.equal((await call('login', body)).status, 400);
  assert.equal(attempts, 1);
});
test('cross-origin and arbitrary gateway requests are refused', async t => {
  let calls = 0;
  const { call, base } = await fixture(t, async () => { calls++; throw Error('unexpected'); });
  assert.equal((await call('captcha', {}, { Origin: 'https://untrusted.example' })).status, 403);
  const hostileHostStatus = await new Promise((resolve, reject) => {
    const req = http.request(base + '/api/status', { headers: { Host: 'attacker.example', 'X-GDT-Local': '1' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(hostileHostStatus, 403);
  assert.equal((await fetch(base + '/api/status')).status, 403);
  assert.equal((await call('proxy', { url: 'http://example.com' })).status, 404);
  assert.equal(calls, 0);
});
test('online origin requires a per-process pairing token and supports private-network preflight', async t => {
  const server = createApp(async path => path === '/api/captcha' ? {status:200,data:{key:'k',content:'<svg></svg>'}} : {status:500,data:{}}, {onlineOrigin:'https://online.example',pairingToken:'pair-secret'});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const preflight=await fetch(base+'/api/status',{method:'OPTIONS',headers:{Origin:'https://online.example','Access-Control-Request-Private-Network':'true'}});
  assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://online.example');assert.equal(preflight.headers.get('access-control-allow-private-network'),'true');
  const denied=await fetch(base+'/api/status',{headers:{Origin:'https://online.example','X-GDT-Local':'1'}});assert.equal(denied.status,403);
  const allowed=await fetch(base+'/api/status',{headers:{Origin:'https://online.example','X-GDT-Local':'1','X-GDT-Pairing':'pair-secret'}});assert.equal(allowed.status,200);
  const pairing=await fetch(base+'/api/pairing',{headers:{'X-GDT-Local':'1'}});assert.equal((await pairing.json()).token,'pair-secret');
});
test('default production origins are allowed and cross-site navigation can open the local page', async t => {
  const server=createApp(async()=>({status:500,data:{}}),{pairingToken:'pair-secret'});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));const base=`http://127.0.0.1:${server.address().port}`;
  for(const origin of ['https://anhmedia.vn','https://anhmedia.vn:8443']){const response=await fetch(base+'/api/status',{headers:{Origin:origin,'X-GDT-Local':'1','X-GDT-Pairing':'pair-secret'}});assert.equal(response.status,200);assert.equal(response.headers.get('access-control-allow-origin'),origin);}
  const page=await fetch(base+'/',{headers:{'Sec-Fetch-Site':'cross-site','Sec-Fetch-Mode':'navigate'}});assert.equal(page.status,200);const api=await fetch(base+'/api/status',{headers:{'Sec-Fetch-Site':'cross-site','X-GDT-Local':'1'}});assert.equal(api.status,403);
});
test('profile failure does not retain a partially authenticated session', async t => {
  const { call } = await fixture(t, async path => path === '/api/captcha'
    ? { status: 200, data: { key: 'challenge', content: '<svg></svg>' } }
    : path.endsWith('/authenticate') ? { status: 200, data: { token: 'private' } } : { status: 401, data: {} });
  const challengeId = (await call('captcha', {})).data.challengeId;
  assert.equal((await call('login', { username: 'test', password: 'sample', cvalue: 'abc', challengeId })).status, 401);
  assert.equal((await call('status')).data.authenticated, false);
  assert.equal((await call('status')).data.lastFailure.stage, 'profile verification');
});
test('opening another tab does not replace the first CAPTCHA key or cookies', async t => {
  let count = 0, submitted;
  const { call } = await fixture(t, async (path, options) => {
    if (path === '/api/captcha') { count++; options.cookies.set('session', String(count)); return { status: 200, data: { key: `key-${count}`, content: '<svg></svg>' } }; }
    if (path.endsWith('/authenticate')) { submitted = { key: options.body.ckey, cookie: options.cookies.get('session') }; return { status: 403, data: {} }; }
    throw Error('Unexpected request');
  });
  const first = (await call('captcha', {})).data.challengeId;
  await call('captcha', {});
  await call('login', { username: 'test', password: 'sample', cvalue: 'abc', challengeId: first });
  assert.deepEqual(submitted, { key: 'key-1', cookie: '1' });
  assert.equal((await call('status')).data.lastFailure.stage, 'authentication');
});
test('date filters and cursor are encoded; invalid range cannot reach the gateway', () => {
  const path = invoicePath({ from: '2024-02-29', to: '2024-03-01', direction: 'sold', state: 'abc&size=999' });
  const url = new URL(path, 'https://example.com');
  assert.equal(url.searchParams.get('size'), '15');
  assert.equal(url.searchParams.get('state'), 'abc&size=999');
  assert.equal(url.searchParams.get('search'), 'tdlap=ge=29/02/2024T00:00:00;tdlap=le=01/03/2024T23:59:59');
  for (const from of ['2025-02-29', 'bad']) assert.throws(() => invoicePath({ from, to: '2025-03-01', direction: 'purchase' }));
  assert.throws(() => invoicePath({ from: '2025-01-01', to: '2025-01-31', direction: 'purchase' }));
  assert.doesNotThrow(() => invoicePath({ from: '2025-01-01', to: '2025-01-30', direction: 'purchase' }));
});
