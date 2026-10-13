const assert = require("assert");
const { shouldFold } = require("./fold.js");
assert.strictEqual(shouldFold({ slop: true, confidence: 0.85 }), true);
assert.strictEqual(shouldFold({ slop: true, confidence: 0.8 }), false);
assert.strictEqual(shouldFold({ slop: false, confidence: 0.99 }), false);
assert.strictEqual(shouldFold(null), false);
console.log("fold checks ok");

// Dedupe: three posts with the same text (LinkedIn remounts) -> exactly one Jev call, all fold.
const vm = require("vm"), fs = require("fs");
const TEXT = "Excited to share 7 lessons about leadership that changed everything. Agree?";
let calls = 0;
const mkPost = () => {
  const p = { dataset: {}, isConnected: true, cls: new Set(), prepended: 0,
    querySelector: () => ({ innerText: TEXT }), prepend() { this.prepended++; } };
  p.classList = { add: (c) => p.cls.add(c), remove: (c) => p.cls.delete(c), contains: (c) => p.cls.has(c) };
  return p;
};
const posts = [mkPost(), mkPost(), mkPost()];
const el = () => ({ append() {}, addEventListener() {}, remove() {} });
const ctx = {
  console, setTimeout, clearTimeout, shouldFold,
  MutationObserver: class { observe() {} },
  document: { body: {}, createElement: el, querySelectorAll: () => posts },
  chrome: { runtime: { lastError: null, sendMessage: (_m, cb) => { calls++; setTimeout(() => cb({ ok: true, slop: true, confidence: 0.9 }), 5); } } },
};
vm.runInNewContext(fs.readFileSync(__dirname + "/content.js", "utf8"), ctx);
setTimeout(() => {
  assert.strictEqual(calls, 1, `expected 1 Jev call, got ${calls}`);
  assert.ok(posts.every((p) => p.cls.has("slop-folded") && p.prepended === 1), "all three copies fold once");
  console.log("dedupe checks ok");
}, 50);
