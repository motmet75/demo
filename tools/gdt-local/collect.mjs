// Authenticated, resumable local collection; no passwords or tokens on disk.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { renderPdf } from './pdf.mjs';

const [taxId, from, to] = process.argv.slice(2);
const day = s => { const n = Date.parse(s + 'T00:00:00Z'); if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '') || !Number.isFinite(n) || new Date(n).toISOString().slice(0,10) !== s) throw Error('Invalid date'); return n; };
if (!/^\d{10}(\d{3})?$/.test(taxId || '')) throw Error('Usage: node collect.mjs TAX_ID FROM TO');
const start = day(from), end = day(to);
if (end < start || end - start > 366 * 86400000) throw Error('Invalid period');
const root = resolve('tmp/gdt-reports', taxId, `${from}_${to}`);
await mkdir(root, { recursive: true });
async function api(name, body) {
  const r = await fetch('http://127.0.0.1:8765/api/' + name, { method: body ? 'POST' : 'GET', headers: { 'X-GDT-Local': '1', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json(); if (!r.ok) throw Error(`${name}: ${data.message || r.status}`); return data;
}
const status = await api('status');
if (!status.authenticated || ![status.profile?.username,status.profile?.mst,status.profile?.groupId].includes(taxId)) throw Error('Sign in to the requested company first');
const manifest = { taxId, from, to, startedAt: new Date().toISOString(), coverage: 'ordinary query API only; cash-register coverage unverified', complete: false, windows: [], files: [], errors: [] };
const save = () => writeFile(root + '/manifest.json', JSON.stringify(manifest, null, 2));
const invoices = new Map();
try {
  for (const direction of ['purchase', 'sold']) for (let n = start; n <= end; n += 30 * 86400000) {
    const window = { direction, from: new Date(n).toISOString().slice(0,10), to: new Date(Math.min(end,n+29*86400000)).toISOString().slice(0,10) };
    let state, page = 0, total; const states = new Set(), keys = new Set();
    while (true) {
      const name = `${direction}-${window.from}-${++page}.json`;
      // Cached source pages are a snapshot; use a new directory for a fresh extraction.
      let data; try { data = JSON.parse(await readFile(root + '/' + name, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; data = await api('invoices', { ...window, state }); await writeFile(root + '/' + name, JSON.stringify(data,null,2)); }
      if (!Array.isArray(data.datas) || !Number.isInteger(Number(data.total))) throw Error('Invalid page or missing total');
      if (total !== undefined && total !== Number(data.total)) throw Error('Portal total changed during pagination');
      total = Number(data.total);
      for (const invoice of data.datas) {
        const key = [direction, invoice.nbmst, invoice.khmshdon, invoice.khhdon, invoice.shdon, invoice.id || ''].join('|');
        keys.add(key); invoices.set(key, { ...invoice, _direction: direction });
      }
      if (keys.size === total) break;
      if (keys.size > total || !data.state || states.has(data.state) || !data.datas.length || page >= 1000) throw Error('Incomplete pagination: count/cursor mismatch');
      states.add(data.state); state = data.state;
    }
    manifest.windows.push({ ...window, total, pages: page, verified: true }); await save();
    console.log(`${direction} ${window.from}..${window.to}: ${total}`);
  }
  await writeFile(root + '/invoices.json', JSON.stringify([...invoices.values()],null,2));
  manifest.listComplete = true; await save();
  for (const invoice of invoices.values()) {
    const identity = Object.fromEntries(['nbmst','khmshdon','khhdon','shdon'].map(k => [k,invoice[k]]));
    const id = createHash('sha256').update(JSON.stringify([invoice._direction,identity,invoice.id])).digest('hex').slice(0,24);
    const base = `${invoice._direction}-${id}`;
    try {
      let detail;
      try { detail = JSON.parse(await readFile(root + '/' + base + '.json','utf8')); } catch(e) { if(e.code !== 'ENOENT') throw e; detail = await api('detail', identity); await writeFile(root + '/' + base + '.json',JSON.stringify(detail,null,2)); }
      let zip;
      try { zip = await readFile(root + '/' + base + '.zip'); } catch(e) { if(e.code !== 'ENOENT') throw e; const d = await api('xml',{...identity,direction:invoice._direction}); zip = Buffer.from(d.data,'base64'); if(zip.readUInt32LE(0)!==0x04034b50) throw Error('Invalid ZIP signature'); await writeFile(root + '/' + base + '.zip',zip); }
      let pdf; try { pdf = await readFile(root + '/' + base + '.pdf'); } catch(e) { if(e.code !== 'ENOENT') throw e; pdf = await renderPdf(zip); if(pdf.subarray(0,5).toString()!=='%PDF-') throw Error('Invalid PDF'); await writeFile(root + '/' + base + '.pdf',pdf); }
      manifest.files.push({ ...identity, direction: invoice._direction, base, zipSha256:createHash('sha256').update(zip).digest('hex'), pdfBytes:pdf.length });
    } catch(e) { manifest.errors.push({...identity,direction:invoice._direction,message:e.message}); if (/Sign in|HTTP 401|HTTP 403|session expired/i.test(e.message)) throw e; }
    await save(); console.log(`Documents ${manifest.files.length}/${invoices.size}; failures ${manifest.errors.length}`);
  }
  manifest.complete = !manifest.errors.length; manifest.finishedAt = new Date().toISOString(); await save();
} catch(e) { manifest.errors.push({message:e.message}); await save(); console.error(e.message); process.exitCode=1; }
console.log(root);
