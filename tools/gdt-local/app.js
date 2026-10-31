const $ = id => document.getElementById(id);
const reviewLink = document.createElement('a');
reviewLink.href = 'http://127.0.0.1:8766/'; reviewLink.target = '_blank'; reviewLink.rel = 'noopener';
reviewLink.textContent = 'Q3 2026 · 0317544489 · Excel / PDF review';
document.querySelector('header').append(reviewLink);
let page = null, selection = null, pageNumber = 0, challengeId = null, scoChallengeId = null;
function saveFile(result) {
  const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], { type: result.contentType }));
  const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const headings = document.querySelector('#results thead tr');
const directionHeading = document.createElement('th'); directionHeading.textContent = 'Chiều'; headings.prepend(directionHeading);
const downloadHeading = document.createElement('th'); downloadHeading.textContent = 'Tải xuống'; headings.append(downloadHeading);
new MutationObserver(() => {
  [...$('rows').children].forEach((row, index) => {
    if (row.dataset.downloadReady) return;
    const invoice = page?.datas[index]; if (!invoice) return;
    row.dataset.downloadReady = 'true';
    const direction = invoice._direction || page.direction || selection?.direction;
    if (row.children.length === 5) { const cell = document.createElement('td'); cell.textContent = direction === 'sold' ? 'Bán ra' : 'Mua vào'; row.prepend(cell); }
    const cell = document.createElement('td');
    for (const [action, label] of [['pdf', 'PDF'], ['xml', 'ZIP gốc']]) {
      const button = document.createElement('button'); button.className = 'secondary'; button.textContent = label; button.type = 'button';
      button.onclick = () => run(async () => {
        status(`Đang tải ${label} · ${invoice.khhdon}/${invoice.shdon}…`);
        const identity = Object.fromEntries(['nbmst', 'khmshdon', 'khhdon', 'shdon'].map(k => [k, invoice[k]]));
        saveFile(await api(action, { ...identity, direction, source: selection?.source }));
        status(`Đã tải ${label} · ${invoice.khhdon}/${invoice.shdon}.`);
      });
      cell.append(button, document.createTextNode(' '));
    }
    row.append(cell);
  });
}).observe($('rows'), { childList: true });
function setLast30Days() {
  const end = new Date(); end.setHours(0, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - 29);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  $('query').elements.from.value = iso(start); $('query').elements.to.value = iso(end);
}
function status(message, error = false) { $('status').textContent = message; $('status').className = error ? 'error' : ''; }
async function api(path, body) {
  const response = await fetch('/api/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'X-GDT-Local': '1', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}
async function run(work) {
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await work(); } catch (e) { status(e.message, true); }
  finally { document.querySelectorAll('button').forEach(b => b.disabled = false); $('next').disabled = !page?.state; $('bulk').disabled = $('query').elements.source.value === 'cash'; }
}
function showSession(data) {
  $('loginPanel').hidden = data.authenticated;
  $('connected').hidden = $('queryPanel').hidden = !data.authenticated;
  $('identity').textContent = data.authenticated ? Object.entries(data.profile).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
}
async function captcha() {
  const data = await api('captcha', {}); $('captcha').src = data.image;
  challengeId = data.challengeId;
  $('login').elements.cvalue.value = '';
}
async function scoCaptcha() {
  const data = await api('sco-captcha', {});
  $('scoCaptcha').src = data.image; scoChallengeId = data.challengeId; $('scoValue').value = '';
}
function cashProof() {
  const cvalue = $('scoValue').value.trim();
  if (!scoChallengeId || !cvalue) throw new Error('Nhập CAPTCHA máy tính tiền rồi bấm Tìm kiếm.');
  return { challengeId: scoChallengeId, cvalue };
}
async function cashApi(path, body) {
  try { return await api(path, { ...body, ...cashProof() }); }
  catch (e) {
    if (/CAPTCHA/i.test(e.message)) { scoChallengeId = null; await scoCaptcha(); }
    throw e;
  }
}
$('scoRefresh').onclick = () => run(async () => { await scoCaptcha(); status('Đã lấy CAPTCHA máy tính tiền mới.'); });
$('query').elements.source.onchange = () => run(async () => {
  const cash = $('query').elements.source.value === 'cash'; $('scoPanel').hidden = !cash;
  $('bulk').disabled = cash;
  if (cash && $('query').elements.direction.value === 'both') $('query').elements.direction.value = 'purchase';
  if (cash && !scoChallengeId) await scoCaptcha();
  status(cash ? 'Nhập CAPTCHA máy tính tiền một lần; công cụ sẽ dùng lại khi cổng thuế còn chấp nhận.' : 'Đã chọn hóa đơn thường.');
});
$('refresh').onclick = () => run(async () => { await captcha(); status('Mã mới đã sẵn sàng.'); });
$('login').onsubmit = event => {
  event.preventDefault();
  run(async () => {
    status('Đang xác thực với cổng thuế…');
    const body = Object.fromEntries(new FormData(event.target));
    body.challengeId = challengeId;
    try {
      const data = await api('login', body); showSession(data);
      status('Đăng nhập thành công. Có thể tra cứu mẫu hoặc báo Codex để tiếp tục kiểm tra.');
    } catch (e) { try { await captcha(); } catch { /* Preserve the login error. */ } throw e; }
    finally { body.password = ''; event.target.elements.password.value = ''; }
  });
};
$('disconnect').onclick = () => run(async () => { await api('disconnect', {}); page = null; selection = null; $('results').hidden = true; $('rows').replaceChildren(); showSession({ authenticated: false }); await captcha(); status('Đã ngắt kết nối và xóa phiên trên máy này.'); });
async function query(next = false) {
  if (selection?.source === 'cash') {
    if (selection.direction === 'both') throw new Error('Hóa đơn máy tính tiền phải chọn Mua vào hoặc Bán ra.');
    const result = await cashApi('sco-invoices', { ...selection, ...(next ? { state: page.state } : {}) });
    page = result; pageNumber = next ? pageNumber + 1 : 1;
    $('results').hidden = false; $('rows').replaceChildren();
    for (const invoice of page.datas) { const tr = document.createElement('tr'); for (const key of ['shdon', 'khhdon', 'tdlap', 'nbmst', 'tgtttbso']) { const td = document.createElement('td'); td.textContent = invoice[key] ?? ''; tr.append(td); } $('rows').append(tr); }
    $('counts').textContent = `Máy tính tiền · Trang ${pageNumber} · ${page.datas.length} bản ghi · Tổng: ${page.total ?? 'chưa rõ'}`;
    status('Đã nhận dữ liệu máy tính tiền. CAPTCHA sẽ được dùng lại cho trang tiếp theo nếu cổng thuế còn chấp nhận.'); return;
  }
  if (selection?.direction === 'both') { const result = await api('bulk', selection); page = { datas: result.datas, total: result.total, state: null }; pageNumber = 1; $('results').hidden = false; $('rows').replaceChildren(); for (const invoice of page.datas) { const tr = document.createElement('tr'); for (const key of ['_direction', 'shdon', 'khhdon', 'tdlap', 'nbmst', 'tgtttbso']) { const td = document.createElement('td'); td.textContent = invoice[key] ?? ''; tr.append(td); } $('rows').append(tr); } $('counts').textContent = `Mua vào + bán ra · ${result.total} hóa đơn`; status('Đã nhận dữ liệu hai chiều.'); return; }
  const result = await api('invoices', { ...selection, ...(next ? { state: page.state } : {}) });
  page = result; pageNumber = next ? pageNumber + 1 : 1;
  $('results').hidden = false; $('rows').replaceChildren();
  for (const invoice of page.datas) {
    const tr = document.createElement('tr');
    for (const key of ['shdon', 'khhdon', 'tdlap', 'nbmst', 'tgtttbso']) { const td = document.createElement('td'); td.textContent = invoice[key] ?? ''; tr.append(td); }
    $('rows').append(tr);
  }
  $('counts').textContent = `Trang ${pageNumber} · ${page.datas.length} bản ghi · Tổng theo cổng thuế: ${page.total ?? 'chưa rõ'}`;
  status('Đã nhận dữ liệu từ cổng thuế. JSON giữ nguyên các trường của trang kết quả.');
}
$('excel').onclick = () => run(async () => {
  const input = Object.fromEntries(new FormData($('query'))); status('Đang tạo Excel…');
  if (input.direction === 'both') throw new Error('Chọn Mua vào hoặc Bán ra để tải Excel.');
  const result = input.source === 'cash' ? await cashApi('sco-export', input) : await api('export', input);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], { type: result.contentType })); a.download = result.filename; a.click();
  status('Đã tải Excel danh sách hóa đơn.');
});
$('bulk').onclick = () => run(async () => {
  const input = Object.fromEntries(new FormData($('query'))); status('Đang tải các cửa sổ 30 ngày…');
  if (input.source === 'cash') throw new Error('Máy tính tiền: dùng Tải Excel 30 ngày với một CAPTCHA cho mỗi chiều.');
  selection = input;
  const result = await api('bulk', input); page = { datas: result.datas, total: result.total, state: null }; pageNumber = 1;
  $('results').hidden = false; $('rows').replaceChildren();
  for (const invoice of page.datas) { const tr = document.createElement('tr'); for (const key of ['shdon', 'khhdon', 'tdlap', 'nbmst', 'tgtttbso']) { const td = document.createElement('td'); td.textContent = invoice[key] ?? ''; tr.append(td); } $('rows').append(tr); }
  $('counts').textContent = `Toàn bộ khoảng · ${result.windows.length} cửa sổ 30 ngày · ${result.total} hóa đơn sau khử trùng lặp`;
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `gdt-${input.direction}-${input.from}-${input.to}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Đã tải toàn bộ kết quả dạng JSON.');
});
$('query').onsubmit = e => { e.preventDefault(); run(async () => { selection = Object.fromEntries(new FormData(e.target)); page = null; $('results').hidden = true; status('Đang tra cứu…'); await query(); }); };
$('next').onclick = () => run(() => query(true));
$('download').onclick = () => {
  if (!page) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(page, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `gdt-${selection.direction}-page-${pageNumber}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
};
run(async () => {
  setLast30Days();
  const pairing = await api('pairing');
  const online = document.createElement('a'); online.href = pairing.onlineUrl; online.target = '_blank'; online.rel = 'noopener'; online.textContent = 'Mở Invoice Desk online';
  document.querySelector('header').append(document.createTextNode(' · '), online);
  const data = await api('status'); showSession(data);
  if (!data.authenticated) await captcha();
  status(data.authenticated ? 'Phiên đăng nhập đang hoạt động.' : 'Nhập tài khoản và mã CAPTCHA để kết nối.');
});
