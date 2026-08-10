const { randomUUID } = require("crypto");

/** snake_case DB row → camelCase for frontend */
function toCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function rowToCamel(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[toCamel(k)] = v;
  }
  return out;
}

function rowsToCamel(rows) {
  return (rows || []).map(rowToCamel);
}

/** camelCase body → snake_case for SQL column names */
function camelToSnake(str) {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

function bodyToSnake(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    out[camelToSnake(k)] = v;
  }
  return out;
}

function parseJson(val, fallback = null) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function stringifyJson(val) {
  if (val == null) return null;
  return typeof val === "string" ? val : JSON.stringify(val);
}

function newId() {
  return randomUUID();
}

function roundMoney(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = {
  toCamel,
  rowToCamel,
  rowsToCamel,
  camelToSnake,
  bodyToSnake,
  parseJson,
  stringifyJson,
  newId,
  roundMoney,
};
