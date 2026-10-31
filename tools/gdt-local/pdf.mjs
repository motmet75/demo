import { inflateRawSync } from 'node:zlib';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
// Prototype uses the Playwright installation already present in this workspace.
const { chromium } = require('../../tmp/invoice-browser/node_modules/playwright');
export function unpack(bytes) {
  const files = new Map(); let total = 0;
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--;
  if (end < 0 || bytes.readUInt32LE(end) !== 0x06054b50) throw Error('Invalid ZIP');
  const count = bytes.readUInt16LE(end + 10); let at = bytes.readUInt32LE(end + 16);
  if (count > 100) throw Error('Archive has too many entries');
  for (let i = 0; i < count; i++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw Error('Invalid ZIP entry');
    const method = bytes.readUInt16LE(at + 10), size = bytes.readUInt32LE(at + 20), expanded = bytes.readUInt32LE(at + 24);
    const n = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32), offset = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + n).toString('utf8'); at += 46 + n + extra + comment;
    total += expanded; if (total > 40_000_000) throw Error('Expanded archive exceeds limit');
    if (!/^[\w.-]+\.(html|css|jpg|jpeg|png|svg)$/i.test(name)) continue;
    const start = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    const packed = bytes.subarray(start, start + size);
    const data = method === 0 ? packed : method === 8 ? inflateRawSync(packed, { maxOutputLength: 40_000_000 }) : null;
    if (!data || data.length !== expanded) throw Error('Unsupported ZIP data');
    files.set(name, data);
  }
  if (!files.has('invoice.html')) throw Error('Portal archive has no invoice.html');
  return files;
}
export async function renderPdf(bytes) {
  const files = unpack(bytes);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      const name = decodeURIComponent(url.pathname.slice(1));
      if (url.origin !== 'https://invoice.invalid' || !files.has(name)) return route.abort();
      const ext = name.split('.').pop().toLowerCase();
      const type = { html: 'text/html; charset=utf-8', css: 'text/css', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml' }[ext];
      return route.fulfill({ contentType: type, body: files.get(name) });
    });
    const page = await context.newPage();
    await page.goto('https://invoice.invalid/invoice.html');
    await page.evaluate(() => document.fonts.ready);
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally { await browser.close(); }
}
