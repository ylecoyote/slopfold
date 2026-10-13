// KNOB: update these selectors when LinkedIn changes its DOM.
// 2026-10 feed: classes are hashed (gfl...), so key off stable attributes.
const POST_SELECTORS = [
  "div[role='listitem'][componentkey^='update-card-focus']",
  "div.feed-shared-update-v2",
  "div[data-urn^='urn:li:activity:']",
  "div[data-id^='urn:li:activity:']",
];
const TEXT_SELECTORS = [
  "[data-testid='expandable-text-box']",
  ".update-components-text",
  ".feed-shared-update-v2__description",
  ".feed-shared-inline-show-more-text",
];
const MIN_CHARS = 40;
const MAX_INFLIGHT = 3;

let inflight = 0;
const queue = [];
let warned = false;

function postText(post) {
  for (const s of TEXT_SELECTORS) {
    const el = post.querySelector(s);
    if (el && el.innerText.trim()) return el.innerText.trim();
  }
  return "";
}

function fold(post, confidence, text) {
  const bar = document.createElement("div");
  bar.className = "slop-bar";
  const label = document.createElement("span");
  label.textContent = `Folded: likely AI slop (${Math.round(confidence * 100)}%)`;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = "Show anyway";
  // ponytail: native tooltip as the preview; custom popover if it needs styling or no delay.
  btn.title = text.length > 200 ? text.slice(0, 200) + "…" : text;
  btn.addEventListener("click", () => {
    post.classList.remove("slop-folded");
    bar.remove();
  });
  bar.append(label, btn);
  post.classList.add("slop-folded");
  post.prepend(bar);
}

// One Jev call per unique post text: LinkedIn's lazy feed rebuilds posts on scroll,
// and Jev isn't deterministic, so re-asking costs money and flips verdicts.
// ponytail: unbounded per-tab Map, cap it if a tab ever lives for days.
const verdicts = new Map();
function ask(text) {
  if (!verdicts.has(text)) {
    verdicts.set(text, new Promise((resolve) => { queue.push({ text, resolve }); pump(); }));
  }
  return verdicts.get(text);
}

function pump() {
  while (inflight < MAX_INFLIGHT && queue.length) {
    const { text, resolve } = queue.shift();
    inflight++;
    chrome.runtime.sendMessage({ type: "classify", text }, (res) => {
      inflight--;
      if (chrome.runtime.lastError || !res || !res.ok) {
        if (!warned) {
          warned = true;
          console.warn("[slopfold] Jev unreachable, leaving posts visible:", chrome.runtime.lastError?.message || res?.error);
        }
        verdicts.delete(text); // fail open, retry on a later sighting
        resolve(null);
      } else {
        resolve(res);
      }
      pump();
    });
  }
}

function scan() {
  for (const post of document.querySelectorAll(POST_SELECTORS.join(","))) {
    if (post.dataset.slopChecked) continue;
    const text = postText(post);
    if (text.length < MIN_CHARS) continue; // may still be loading; retried on next mutation
    post.dataset.slopChecked = "1";
    ask(text.slice(0, 4000)).then((res) => {
      if (shouldFold(res) && post.isConnected && !post.classList.contains("slop-folded")) fold(post, res.confidence, text);
    });
  }
}

let timer;
new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 300); })
  .observe(document.body, { childList: true, subtree: true });
scan();
