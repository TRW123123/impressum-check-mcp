#!/usr/bin/env bash
# Lokaler MCP-Smoke: health, initialize, tools/list, tools/call positiv und negativ.
# Prüft live genau EINE eigene Domain (höchstens 6 Seitenabrufe), kein Crawling.
set -euo pipefail
base="${1:-http://127.0.0.1:8794}"
site="${2:-https://www.ki-automatisieren.de}"
call() {
  curl --fail-with-body --silent --show-error --max-time 40 "$base/mcp" -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' --data "$1"
  echo
}
curl --fail --silent --show-error --max-time 10 "$base/health"; echo
call '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}'
call '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | cut -c1-300
call '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_impressum_pflichtangaben","arguments":{}}}' | cut -c1-300
call "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"check_impressum\",\"arguments\":{\"url\":\"$site\"}}}" | python3 -c 'import sys,json;r=json.load(sys.stdin)["result"];s=r.get("structuredContent") or {};print("isError",r.get("isError"),"| ampel",s.get("ampel"),"| impressum_gefunden",s.get("impressum_gefunden"),"| seiten",s.get("abgerufene_seiten"));[print(" ",f["id"],f["status"]) for f in s.get("felder",[])];print(r["content"][0]["text"][:200] if r.get("isError") else "")'
echo '# negativ (erwartet isError=true):'
call '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"check_impressum","arguments":{"url":"http://169.254.169.254/latest/meta-data/"}}}'
call '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"check_impressum","arguments":{"url":"http://localhost:8790/"}}}'
