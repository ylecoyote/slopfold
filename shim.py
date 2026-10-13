#!/usr/bin/env python3
"""Local shim: POST /classify {"text": "..."} -> {"slop": bool, "confidence": 0..1}.
Asks Jev (OpenRouter model typesafe/jev-router, override with JEV_MODEL).
Key is read server-side from OPENROUTER_API_KEY (fallback: ~/.claude/jev/key); never sent to the extension.
Binds 127.0.0.1 only."""
import json, os, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("SLOP_SHIM_PORT", "8765"))
MODEL = os.environ.get("JEV_MODEL", "typesafe/jev-router")
MAX_CHARS = 4000
ASK = ("Is this LinkedIn post AI-generated slop (generic, formulaic, engagement-bait, "
       "empty listicle/lesson template, no real specifics)? Answer JSON only: slop = true/false, "
       "confidence = your certainty 0..1 that your slop answer is correct.\n\nPOST:\n")

def key():
    k = os.environ.get("OPENROUTER_API_KEY", "")
    f = Path.home() / ".claude/jev/key"
    return k or (f.read_text().strip() if f.exists() else "")

def ask_jev(text):
    k = key()
    if not k:
        raise RuntimeError("no OPENROUTER_API_KEY (env or ~/.claude/jev/key)")
    body = {"model": MODEL, "messages": [{"role": "user", "content": ASK + text[:MAX_CHARS]}],
            "response_format": {"type": "json_schema", "json_schema": {"name": "slop", "strict": True, "schema": {
                "type": "object", "additionalProperties": False, "required": ["slop", "confidence"],
                "properties": {"slop": {"type": "boolean"}, "confidence": {"type": "number"}}}}}}
    req = urllib.request.Request("https://openrouter.ai/api/v1/chat/completions", json.dumps(body).encode(),
                                 {"Authorization": f"Bearer {k}", "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req, timeout=25))
    v = json.loads(r["choices"][0]["message"]["content"])
    if not isinstance(v.get("slop"), bool) or not isinstance(v.get("confidence"), (int, float)):
        raise ValueError(f"bad answer from Jev: {v!r}")  # fail closed
    return {"slop": v["slop"], "confidence": max(0.0, min(1.0, float(v["confidence"])))}

class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)
    def do_POST(self):
        if self.path != "/classify":
            return self._send(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > 20000:
                return self._send(413, {"error": "bad size"})
            text = json.loads(self.rfile.read(n)).get("text")
            if not isinstance(text, str) or not text.strip():
                return self._send(400, {"error": "text required"})
            v = ask_jev(text.strip())
            print(f"{'SLOP' if v.get('slop') else 'ok  '} {v.get('confidence', 0):.2f}  {text.strip()[:70]!r}", flush=True)
            self._send(200, v)
        except Exception as e:
            print(f"ERR  {str(e)[:200]}", flush=True)
            self._send(502, {"error": str(e)[:200]})
    def log_message(self, *a):
        pass

if __name__ == "__main__":
    print(f"slop shim on http://127.0.0.1:{PORT}/classify (model {MODEL})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
