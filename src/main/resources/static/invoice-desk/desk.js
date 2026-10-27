const $ = selector => document.querySelector(selector);
const base = location.pathname.split('/invoice-desk')[0];
const keys = ['seller','sellerTaxId','buyer','buyerTaxId','serial','number','date','currency','subtotal','vat','total'];
const itemKeys = ['line','description','unit','hsCode','materialCode','quantity','unitPrice','amount','truckPlate','notes','originalDescription'];
let documents = [], selected = null, suppliers = [];
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text, error = false) { $('#message').textContent = text; $('#message').className = error ? 'error' : ''; }
async function request(path, options = {}) {
  const response = await fetch(base + '/api/invoice-desk' + path, {credentials:'same-origin', ...options, headers:{'X-Invoice-Desk':'true', ...(options.body instanceof FormData ? {} : {'Content-Type':'application/json'}), ...options.headers}});
  if (!response.ok) { let body; try { body = await response.json(); } catch { body = {}; } throw new Error(body.message || body.detail || `Request failed (${response.status})`); }
  return response.status === 204 || response.headers.get('content-length') === '0' ? null : response.headers.get('content-type')?.includes('json') ? response.json() : response.blob();
}
async function action(work) { try { await work(); } catch (e) { message(e.message, true); } }
async function start() {
  const context = await request('/context'); $('#company').textContent = context.company; $('#login').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false;
  await reload(); tab('documents');
}
async function reload() { documents = await request('/documents'); suppliers = await request('/suppliers'); renderList(); renderSuppliers(); }
function tab(id) { document.querySelectorAll('.tab').forEach(el => el.hidden = el.id !== id); document.querySelectorAll('[data-tab]').forEach(el => el.classList.toggle('active', el.dataset.tab === id)); if (id === 'learning') action(loadLearning); if (id === 'settings') action(loadOcrSettings); }
document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => tab(el.dataset.tab));
$('#login').onsubmit = e => { e.preventDefault(); action(async () => {
  const form = new FormData(e.target); const response = await fetch(base + '/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(form))});
  const body = await response.json(); if (!response.ok || !body.authenticated) throw new Error(body.message || 'Login requires additional verification; use the main application login.');
  $('#login [name=password]').value = ''; await start(); message('Signed in.');
}); };
$('#logout').onclick = () => action(async () => { await fetch(base + '/auth/logout', {method:'POST'}); location.reload(); });
$('#files').onchange = e => action(async () => {
  const input = e.target; input.disabled = true;
  try { const files = [...input.files]; for (let i=0;i<files.length;i++) { message(`Processing ${i+1}/${files.length}: ${files[i].name}`); const body = new FormData(); body.append('file',files[i]); selected = await request('/documents',{method:'POST',body}); }
    await reload(); if(selected) renderReview(); message('Import complete. Review extracted values and warnings.');
  } finally { input.disabled=false; input.value=''; }
});
function renderList() {
  $('#count').textContent = documents.length;
  $('#document-list').innerHTML = documents.length ? documents.map(d => `<button class="entry" data-id="${d.id}">${escapeHtml(d.invoice.source)}<small>${escapeHtml(d.invoice.fields.seller || 'Supplier needs review')} · ${d.invoice.approved ? 'Approved' : 'Draft'}</small></button>`).join('') : '<p>No documents yet. Import your first invoice.</p>';
  $('#document-list').querySelectorAll('[data-id]').forEach(button => button.onclick = () => { selected = documents.find(d => d.id === button.dataset.id); renderReview(); });
}
function renderReview() {
  const invoice=selected.invoice;
  $('#review').innerHTML=`<h2>${escapeHtml(invoice.source)}</h2><p>${escapeHtml(invoice.type)} · ${escapeHtml(invoice.method)} · ${invoice.approved?'Approved':'Draft'}</p><a href="${escapeHtml(base)}/api/invoice-desk/documents/${selected.id}/source">Download original source</a>
    ${invoice.warnings.length ? `<pre class="warning">${escapeHtml(invoice.warnings.join('\n'))}</pre>` : ''}
    <div class="fields">${keys.map(k=>`<label>${k}<input data-field="${k}" value="${escapeHtml(invoice.fields[k])}"></label>`).join('')}</div>
    <h2>Line items</h2><div class="scroll"><table><thead><tr>${itemKeys.map(k=>`<th>${({truckPlate:"Biển số xe",notes:"Ghi chú",originalDescription:"Mô tả gốc"})[k]||k}</th>`).join('')}<th></th></tr></thead><tbody id="items"></tbody></table></div><button id="add-item">Add line</button>
    <div class="actions"><button id="reprocess">Re-run OCR</button><button id="save">Save draft</button><button id="approve">Approve & save learning</button><button id="apply">Apply supplier rules</button></div><details><summary>Extracted source text</summary><pre>${escapeHtml(invoice.text)}</pre></details>`;
  $('#reprocess').onclick=()=>action(async()=>{
    if(!confirm('Re-run OCR from the stored source? This replaces draft fields and line items, including unsaved edits. If Google Vision is configured, source images will be sent to Google Cloud.')) return;
    const button=$('#reprocess'); button.disabled=true;
    try { message('Running OCR...'); selected=await request(`/documents/${selected.id}/reprocess`,{method:'POST',body:JSON.stringify({version:selected.version})}); await reload(); renderReview(); message('OCR finished. Review the extracted text and fields.'); }
    finally { button.disabled=false; }
  });
  invoice.items.forEach(addItem); $('#add-item').onclick=()=>addItem({line:String($('#items').children.length+1)});
  $('#save').onclick=()=>action(()=>save(false)); $('#approve').onclick=()=>action(()=>save(true));
  $('#apply').onclick=()=>action(async()=>{ await save(false); selected=await request(`/documents/${selected.id}/rules`,{method:'POST',body:JSON.stringify({version:selected.version})}); await reload();renderReview();message('Supplier rules applied. Verify the resulting draft.'); });
}
function addItem(item) { const row=document.createElement('tr'); row.original={...item}; row.innerHTML=itemKeys.map(k=>`<td><input aria-label="${k}" data-key="${k}" value="${escapeHtml(item[k])}"></td>`).join('')+'<td><button aria-label="Remove line">Remove</button></td>'; row.querySelector('button').onclick=()=>row.remove(); $('#items').append(row); }
async function save(approve) {
  const fields=Object.fromEntries([...document.querySelectorAll('[data-field]')].map(el=>[el.dataset.field,el.value]));
  const items=[...$('#items').children].map(row=>({...row.original,...Object.fromEntries([...row.querySelectorAll('[data-key]')].map(el=>[el.dataset.key,el.value]))}));
  selected=await request('/documents/'+selected.id,{method:'PUT',body:JSON.stringify({version:selected.version,fields,items,approve})}); await reload();renderReview();message(approve?'Approved. Learning example saved in SQL.':'Draft saved.');
}
async function download(draft) { const blob=await request('/export?draft='+draft); const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=draft?'draft-invoices.xlsx':'approved-invoices.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
$('#draft').onclick=()=>action(()=>download(true)); $('#export').onclick=()=>action(()=>download(false));
function renderSuppliers() { $('#supplier-list').innerHTML=suppliers.map((s,i)=>`<button class="entry" data-index="${i}">${escapeHtml(s.name)}<small>${escapeHtml(s.taxId)} · ${s.rules.length} rules</small></button>`).join(''); $('#supplier-list').querySelectorAll('button').forEach(b=>b.onclick=()=>editSupplier(suppliers[Number(b.dataset.index)])); }
function editSupplier(s={taxId:'',name:'',notes:'',rules:[]}) { for(const k of ['taxId','name','notes'])$('#supplier-form').elements[k].value=s[k]; $('#rules').replaceChildren(); s.rules.forEach(addRule); }
function addRule(rule={field:'number',pattern:'',value:'',required:false}) { const row=document.createElement('div');row.className='rule';row.innerHTML=`<select aria-label="Field">${keys.filter(k=>k!=='sellerTaxId').map(k=>`<option ${k===rule.field?'selected':''}>${k}</option>`).join('')}</select><input aria-label="Capture pattern" placeholder="Pattern with (capture group)" value="${escapeHtml(rule.pattern)}"><input aria-label="Fixed value" placeholder="Fixed value" value="${escapeHtml(rule.value)}"><label><input type="checkbox" ${rule.required?'checked':''}> Required</label><button type="button">Remove</button>`;row.querySelector('button').onclick=()=>row.remove();$('#rules').append(row); }
$('#new-supplier').onclick=()=>editSupplier(); $('#add-rule').onclick=()=>addRule();
$('#supplier-form').onsubmit=e=>{e.preventDefault();action(async()=>{ const form=e.target;const data=Object.fromEntries(new FormData(form));data.rules=[...$('#rules').children].map(row=>({field:row.querySelector('select').value,pattern:row.querySelectorAll('input')[0].value,value:row.querySelectorAll('input')[1].value,required:row.querySelector('[type=checkbox]').checked})); await request('/suppliers',{method:'PUT',body:JSON.stringify(data)});await reload();message('Supplier configuration saved.'); });};
async function loadLearning() { const rows=await request('/learning');$('#learning-list').innerHTML=rows.length?rows.map(row=>`<details class="card"><summary>${escapeHtml(row.tax_id)} · ${escapeHtml(row.reviewed_by)} · ${escapeHtml(row.created_at)}</summary><p>Source SHA-256: ${escapeHtml(row.sha256)}</p><pre>${escapeHtml(row.approved_payload)}</pre></details>`).join(''):'<p>No approved examples yet.</p>'; }
start().catch(()=>message('Sign in to open your invoice workspace.'));

async function loadOcrSettings() { const settings=await request('/settings'); $('#ocr-status').textContent=`Provider: ${settings.provider}. ${settings.message}`; }
$('#refresh-ocr').onclick=()=>action(loadOcrSettings);
