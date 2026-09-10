/** Client-side API helpers for the PostgreSQL-backed backend */

const API_BASE = import.meta.env.VITE_API_URL || 'https://pickleballsystemadmin.onrender.com';

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `POST ${path} failed: ${res.status}`);
  }
  return res.json();
}

export async function apiPut(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiPatch(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} failed: ${res.status}`);
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
  return res.json();
}

/**
 * Poll-based replacement for realtime listeners.
 * Returns an unsubscribe function.
 */
export function subscribePoll(fetchFn, callback, intervalMs = 5000) {
  let cancelled = false;
  let timer = null;

  async function tick() {
    if (cancelled) return;
    try {
      const data = await fetchFn();
      callback(data);
    } catch (err) {
      console.error("subscribePoll error:", err);
    }
    if (!cancelled) {
      timer = setTimeout(tick, intervalMs);
    }
  }

  tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}

/** Subscribe to a single resource by id */
export function subscribeOne(getListFn, id, callback, intervalMs = 5000) {
  return subscribePoll(
    async () => {
      const list = await getListFn();
      return list.find((x) => x.id === id) || null;
    },
    callback,
    intervalMs
  );
}

export function tsToMs(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === "string") return new Date(val).getTime() || 0;
  if (typeof val.toDate === "function") return val.toDate().getTime();
  if (val._seconds != null) return val._seconds * 1000;
  return 0;
}
