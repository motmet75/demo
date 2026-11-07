const $ = id => document.getElementById(id);
function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) return reject(Error(chrome.runtime.lastError.message));
      if (!response?.ok) return reject(Error(response?.error || "Extension error"));
      resolve(response);
    });
  });
}
async function update() {
  const r = await send({type: "status"});
  const s = r.state || {};
  const paired = Boolean(s.workerToken);
  const poll = s.lastPollAt ? new Date(s.lastPollAt).toLocaleTimeString() : "Not yet";
  $("state").textContent =
    "Paired: " + (paired ? "Yes" : "No") +
    "\nEnabled: " + (s.enabled ? "Yes" : "No") +
    "\nLast poll: " + poll +
    "\nLast VIN request: " + (s.lastJobPath ? s.lastJobPath.split("/").pop() : "None") +
    "\nLast VIN HTTP status: " + (s.lastVinHttpStatus || "No response") +
    "\nLast VIN job at: " + (s.lastJobAt ? new Date(s.lastJobAt).toLocaleTimeString() : "None") +
    (s.lastJobError ? "\nVIN request error: " + s.lastJobError : "") +
    (s.lastError ? "\nRelay error: " + s.lastError : "");
}
$("pair").addEventListener("click", async () => {
  $("state").textContent = "Pairing...";
  try {await send({type:"pair", code:$("code").value});$("code").value="";await update();}
  catch(e){$("state").textContent=e.message;}
});
$("disconnect").addEventListener("click", async () => {
  try {await send({type:"disconnect"});await update();}
  catch(e){$("state").textContent=e.message;}
});
update().catch(e=>$("state").textContent=e.message);
