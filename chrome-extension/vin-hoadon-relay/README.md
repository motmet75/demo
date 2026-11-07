# VIN-HOADON Chrome relay (Vietnam browser)

Demo's optional server relay moves outgoing VIN-HOADON requests from AWS Seoul to a trusted Chrome browser on a network that can reach VIN-HOADON. The actual VIN credentials continue to live in the existing encrypted per-company database configuration; the extension receives transient requests and bearer tokens in memory.

## Requirements

- Google Chrome 120+ on a trusted Vietnam computer. Test `Test-NetConnection ws.vin-hoadon.com -Port 443` first.
- Demo reachable at `https://anhmedia.vn` and deployed with the matching Java relay classes.
- Admin logged in at `https://anhmedia.vn` to create a **5-minute, one-time pairing code**.
- A stable random server-side relay signing secret of at least 32 bytes, distinct from `VIN_HOADON_MASTER_KEY`.

## Server configuration

Append to `/opt/tuonghoa/demo/secrets/application-secrets.properties`:

```properties
VIN_HOADON_RELAY_ENABLED=true
VIN_HOADON_RELAY_SECRET=replace-with-long-random-secret
VIN_HOADON_RELAY_TIMEOUT_SECONDS=120
```

Generate a suitable secret locally with `openssl rand -hex 32`. Do not publish it. Keep `VIN_HOADON_MASTER_KEY` unchanged. Rebuild and restart Demo. If your deployed website is not `https://anhmedia.vn`, adjust both `API` in background.js and the manifest host permission, then reinstall the extension.

## Install extension

In Chrome navigate to `chrome://extensions`, switch on Developer mode, click **Load unpacked**, and select this directory (`chrome-extension/vin-hoadon-relay`). Keep Chrome open on the Vietnam machine. Chrome MV3 polls every 30 seconds; each job is taken once, never automatically requeued after a timeout.

## Create pairing code

On a *logged-in* `https://anhmedia.vn` tab as ADMIN or SUPER_ADMIN, open Developer Tools > Console and execute:

```js
fetch('/sapi/api/vin-hoadon/relay/pair-code', {method: 'POST', credentials: 'include'})
  .then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.message || r.status); console.log('Pair code:', data.code); })
  .catch(console.error);
```

Only use the pairing code in your own extension. Enter the eight digits into the popup and click **Pair & enable**. An access token valid 20 minutes and a renewal token valid 45 days are issued by Demo; renewal runs automatically. Pairing code expires in five minutes, allows five guesses, and is consumed on success.

## Test without issuing invoices

Wait up to 30 seconds for poll to show an updated time. Then, using your normal authenticated shop UI, open VIN-HOADON configuration and request invoice templates. If that succeeds, the relay can reach the real VIN service. Do **not** retry old invoices with RECONCILE until their remote status has been checked.

## Troubleshooting

- `relay offline`: Chrome/extension not paired or polling, incorrect Demo origin, or backend not enabled.
- `HTTP 401` on /next: pairing or renewal token invalid; pair again.
- `Failed to fetch`: check Vietnam computer connectivity / proxy / certificate and Chrome network permissions.
- `relay timed out`: examine extension popup error and verify VIN invoice status before retrying.
- `HTTP 500` from VIN: provider responded, investigate credentials or provider server after transport.

## Security notes

1. Relay endpoints accept signed bearer tokens. Treat the Vietnam computer and its Chrome profile as a **trusted system** because the browser temporarily sees invoice payloads and VIN tokens.
2. Never paste actual VIN credentials into the extension popup. Pairing uses a one-time code instead.
3. Disconnect deletes tokens locally, but the stateless renewal token remains valid until it expires. To revoke every paired extension immediately, change `VIN_HOADON_RELAY_SECRET` and restart Demo; this also invalidates all sessions.
4. Use HTTPS and keep Chrome extension unpacked on a trusted machine. Disable relay with `VIN_HOADON_RELAY_ENABLED=false` to restore direct AWS requests. Do not leave a relay enabled without an active paired browser.
5. Pending jobs exist in Demo JVM memory only; a restart interrupts them. A job dispatched to Chrome is not automatically retried to avoid duplicate invoices.
6. Access to pairing must be limited to trusted admins. Demo's existing /api VIN relay security rule enforces admin roles for generating pairing codes.
