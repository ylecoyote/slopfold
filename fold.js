// Pure fold decision, shared by content.js (via global) and the node check.
const SLOP_THRESHOLD = 0.8;
function shouldFold(res, threshold = SLOP_THRESHOLD) {
  return !!res && res.slop === true && res.confidence > threshold;
}
if (typeof module !== "undefined") module.exports = { shouldFold, SLOP_THRESHOLD };
