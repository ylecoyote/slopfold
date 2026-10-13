const SHIM = "http://127.0.0.1:8765/classify";

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "classify") return;
  fetch(SHIM, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: String(msg.text).slice(0, 4000) }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("shim HTTP " + r.status))))
    .then((v) => sendResponse({ ok: true, slop: v.slop, confidence: v.confidence }))
    .catch((e) => sendResponse({ ok: false, error: String(e) }));
  return true; // async response
});
