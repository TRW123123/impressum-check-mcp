#!/usr/bin/env bash
set -euo pipefail
if command -v gitleaks >/dev/null 2>&1; then
  scanner=gitleaks
elif [ -x /home/box/.local/bin/gitleaks ]; then
  scanner=/home/box/.local/bin/gitleaks
else
  python3 - <<'PY'
from pathlib import Path
import re,sys
bad=[]
for p in Path('.').rglob('*'):
 if not p.is_file() or any(x in p.parts for x in ['.git','node_modules','.wrangler']): continue
 if p.name=='secret-scan.sh': continue
 try:s=p.read_text()
 except (UnicodeError,OSError):continue
 if re.search(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:sk_live_|sk-proj-|ghp_)[A-Za-z0-9]{20,}',s):bad.append(str(p))
print('Fallback secret scan: '+('FAILED: '+', '.join(bad) if bad else 'passed (working tree only; install gitleaks for history scan).'))
sys.exit(bool(bad))
PY
  exit $?
fi
"$scanner" detect --no-banner --redact --no-git
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  "$scanner" detect --no-banner --redact
fi
