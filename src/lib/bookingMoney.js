/** @param {unknown} n */
export function roundMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.round(v * 100) / 100;
}

/** Parses user-typed cash (allows commas). */
export function parseCashAmount(raw) {
  const s = String(raw ?? "").trim().replace(/,/g, "");
  if (s === "") return NaN;
  const num = Number.parseFloat(s);
  return Number.isFinite(num) ? num : NaN;
}

/** @param {unknown} raw */
export function parseAmountPaid(raw) {
  return parseCashAmount(raw);
}
