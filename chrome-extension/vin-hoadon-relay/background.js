const API = "https://anhmedia.vn/sapi/api/vin-hoadon/relay";
const VIN_ORIGINS = new Set([
  "https://ws.vin-hoadon.com",
  "https://demows.vin-hoadon.com"
]);
const PERIOD_MIN = 0.5;
let running = false;

async function state() {
  return chrome.storage.local.get(["agentId", "accessToken", "workerToken", "accessExpiresAt", "enabled", "lastError", "lastSuccessAt", "lastPollAt", "lastJobAt", "lastJobPath", "lastVinHttpStatus", "lastJobError"]);
}
async function setError(message) {
  await chrome.storage.local.set({lastError: String(message || "Unknown error").slice(0, 200)});
}
async function api(path, method, token, payload) {
  const response = await fetch(API + path, {
    method,
    headers: {
      ...(token ? {"Authorization": "Bearer " + token} : {}),
      ...(payload !== undefined ? {"Content-Type": "application/json"} : {})
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    cache: "no-store"
  });
  if (!response.ok) throw new Error("Demo relay " + path + " HTTP " + response.status);
  if (response.status === 204) return null;
  return response.json();
}
async function renewIfNeeded(s) {
  if (!s.workerToken) return s;
  if (s.accessToken && s.accessExpiresAt > Math.floor(Date.now()/1000) + 90) return s;
  const result = await api("/renew", "POST", s.workerToken);
  await chrome.storage.local.set({accessToken: result.accessToken, workerToken: result.workerToken, accessExpiresAt: result.expiresAt});
  return {...s, accessToken: result.accessToken, workerToken: result.workerToken, accessExpiresAt: result.expiresAt};
}
async function processJob(job, token) {
  let status=0, body="", error=null;
  try {
    if (!/^\/api\/services\/hddtws\/[A-Za-z0-9_/-]+$/.test(job.path)) throw new Error("Unsupported path");
    if (!VIN_ORIGINS.has(job.baseUrl)) throw new Error("Unsupported VIN-HOADON origin");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(job.baseUrl + job.path, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          ...(job.bearerToken ? {"Authorization": "Bearer " + job.bearerToken} : {})
        },
        body: JSON.stringify(job.payload),
        signal: controller.signal,
        cache: "no-store"
      });
      status = response.status;
      body = await response.text();
      if (body.length > 1900000) throw new Error("VIN response exceeds size limit");
    } finally {
      clearTimeout(timeout);
    }
  } catch (e) {
    error = e && e.name === "AbortError" ? "VIN request timed out" : (e?.message || "VIN network error");
  }
  // Store diagnostics without sensitive invoice payloads, passwords or access tokens.
  const jobTime = Date.now();
  await chrome.storage.local.set({
    lastJobAt: jobTime,
    lastJobPath: job.path,
    lastVinHttpStatus: status || null,
    lastJobError: error || ""
  });
  try {
    await api("/result", "POST", token, {id: job.id, status, body, error});
  } catch (e) {
    const reportError = "Failed reporting VIN response to Demo: " + (e?.message || "unknown");
    await chrome.storage.local.set({lastError: reportError, lastJobError: reportError});
    throw e;
  }
  if (error) await setError(error);
  else await chrome.storage.local.set({
    lastSuccessAt: jobTime,
    lastError: status >= 400 ? "VIN-HOADON returned HTTP " + status : ""
  });
}
async function poll() {
  if (running) return;
  running = true;
  try {
    let s = await state();
    if (!s.enabled || !s.workerToken) return;
    s = await renewIfNeeded(s);
    for (let i = 0; i < 12; i++) {
      const job = await api("/next", "GET", s.accessToken);
      if (!job) break;
      await processJob(job, s.accessToken);
    }
    await chrome.storage.local.set({lastPollAt: Date.now()});
  } catch(e) {
    await setError(e?.message || "Relay polling failed");
  } finally {
    running = false;
  }
}
async function initialize() {
  await chrome.alarms.create("vin-relay-poll", {periodInMinutes: PERIOD_MIN});
  await poll();
}
chrome.runtime.onInstalled.addListener(() => {initialize();});
chrome.runtime.onStartup.addListener(() => {initialize();});
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === "vin-relay-poll") poll();
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    if (message.type === "pair") {
      const code = String(message.code || "").trim();
      if (!/^\d{8}$/.test(code)) throw new Error("Enter an 8-digit pairing code");
      const s = await state();
      const agentId = s.agentId || crypto.randomUUID();
      const result = await api("/handshake", "POST", null, {code, agentId});
      await chrome.storage.local.set({
        agentId, accessToken: result.accessToken, workerToken: result.workerToken,
        accessExpiresAt: result.expiresAt, enabled: true, lastError: ""
      });
      poll();
      return {ok: true};
    }
    if (message.type === "disconnect") {
      await chrome.storage.local.remove(["accessToken","workerToken","accessExpiresAt"]);
      await chrome.storage.local.set({enabled: false, lastError: ""});
      return {ok: true};
    }
    if (message.type === "poll") {
      poll(); return {ok: true};
    }
    if (message.type === "status") {
      return {ok: true, state: await state()};
    }
    throw new Error("Unsupported command");
  })().then(sendResponse, e => sendResponse({ok: false, error: String(e?.message || e)}));
  return true;
});
initialize();
