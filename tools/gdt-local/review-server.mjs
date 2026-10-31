// Read-only local review server for one explicitly selected report directory.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(process.argv[2] || 'tmp/gdt-reports/0317544489/2026-07-01_2026-09-30');
const types={'.html':'text/html; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pdf':'application/pdf','.zip':'application/zip','.json':'application/json'};
http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
  if(req.method!=='GET'||req.headers.host!=='127.0.0.1:8766'||req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:8766')) {res.writeHead(403);res.end('Local review only');return;}
  const name=req.url==='/'?'review.html':req.url.slice(1);
  if(!/^(review\.html|review-package\.zip|invoice-review\.xlsx|manifest\.json|(purchase|sold)-[a-f0-9]{24}\.(pdf|zip))$/.test(name)){res.writeHead(404);res.end();return;}
  try {const data=await readFile(resolve(root,name));const ext=name.slice(name.lastIndexOf('.'));res.setHeader('Content-Type',types[ext]);if(['.xlsx','.zip'].includes(ext))res.setHeader('Content-Disposition',`attachment; filename="${name}"`);res.end(data);} catch{res.writeHead(404);res.end('File unavailable');}
}).listen(8766,'127.0.0.1',()=>console.log('Invoice review: http://127.0.0.1:8766'));
