#!/usr/bin/env bash
# Read-only multi-tenant Portal Web (8083) diagnostics. No secrets, file writes,
# restarts, or Nginx changes. Python uses stdlib only.
set -Eeuo pipefail
ROOT="${PORTAL_LIVE_ROOT:-/opt/portal-live}"
XML="${PORTAL_CONFIG_XML:-/opt/tuonghoa/portal/xml/config.xml}"
URL="${PORTAL_WEB_TEST_URL:-http://127.0.0.1:8083/}"
export ROOT XML URL
python3 - <<'PY'
import os, pathlib, re, urllib.request, urllib.error, xml.etree.ElementTree as ET
from http.client import IncompleteRead

domains = [
  "anhmedia.vn", "nncminhchau.vn", "nlsjsc.com",
  "tuonghoa-imex.com", "thegioithan.com", "minhmapshop.com"
]
root = pathlib.Path(os.environ["ROOT"]) / "templates"
xml_path = pathlib.Path(os.environ["XML"])
url = os.environ["URL"]
print("ROOT:", root)
print("XML:", xml_path, "exists =", xml_path.is_file())
if not xml_path.is_file():
    raise SystemExit("Missing xml/config.xml. Check PORTAL_CONFIG_XML.")
configs = ET.parse(xml_path).findall(".//config")
def cfg(el):
    elements = el.findall(".//language")
    en = next((p for p in elements if (p.get("code") or "").lower() == "en"), None)
    chosen = en if en is not None else elements[0] if elements else None
    return (chosen.text or "").strip() if chosen is not None else ""
for host in domains:
    tenant = next((cfg(el) for el in configs if el.get("name") == host and cfg(el)), host)
    folder = next((cfg(el) for el in configs
                   if el.get("name") == "templateFolder"
                   and el.get("tenantId") == tenant and cfg(el)), None)
    print("\n===", host, "tenant =", tenant, "theme =", folder or "<NOT_MAPPED>", "===")
    if folder and ".." not in folder and not folder.startswith("/"):
        candidates = [root / folder / "index.html", root / (folder + ".html")]
        for candidate in candidates:
            print("template:", candidate, "exists =", candidate.is_file(),
                  "readable =", os.access(candidate, os.R_OK) if candidate.exists() else False)
        active = next((p for p in candidates if p.is_file()), None)
        if active:
            # Diagnostic only: identify literal fragments like
            # th:replace="minhmapshop :: head" that need a shared
            # templates/minhmapshop.html alongside theme/index.html.
            content = active.read_text(encoding="utf-8", errors="replace")
            fragment_names = sorted(set(re.findall(
                r'th:(?:replace|insert|include)\\s*=\\s*["\\\']([\\w./-]+)\\s*::',
                content
            )))
            for fragment in fragment_names:
                if ".." in fragment or fragment.startswith("/"):
                    continue
                shared = root / (fragment + ".html")
                print("shared fragment:", shared,
                      "exists =", shared.is_file(),
                      "readable =", os.access(shared, os.R_OK) if shared.exists() else False)
    try:
        req=urllib.request.Request(url,headers={"Host":host,"User-Agent":"portal-web-readonly-diagnostic"})
        with urllib.request.urlopen(req,timeout=20) as resp:
            body=resp.read()
            print("HTTP:",resp.status,"complete_bytes:",len(body),"Content-Type:",resp.headers.get("Content-Type"))
    except IncompleteRead as exc:
        print("INCOMPLETE HTTP BODY; received bytes =", len(exc.partial),
              "(likely exception during Thymeleaf response rendering)")
    except urllib.error.HTTPError as exc:
        print("HTTP:", exc.code, "reason:", exc.reason)
    except Exception as exc:
        print("HTTP/request error:",type(exc).__name__,str(exc))
PY
echo
echo "Relevant Java processes:"
ps -eo pid,ppid,tty,args | grep '[j]ava.*portal-web' || true
echo
echo "If stdout points to /dev/pts/X, inspect THAT terminal for the exception."
echo "For a systemd deployment: sudo journalctl -u portal-web -n 150 --no-pager"
echo "For a redirected process: tail -n 150 /path/to/portal-web.log"
