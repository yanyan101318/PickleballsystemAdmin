import { apiGet, subscribePoll } from "./api";
import { findActiveBookingForCourt } from "./bookingSession";

export async function fetchCourtName(courtId) {
  if (!courtId) return "";
  try {
    const courts = await apiGet("/api/courts");
    const c = courts.find((x) => x.id === courtId);
    return c?.name || "";
  } catch {
    return "";
  }
}

async function loadBookingsForCourt({ courtId, courtName }) {
  const merged = new Map();
  if (courtId) {
    const list = await apiGet(`/api/bookings/search?courtId=${encodeURIComponent(courtId)}`);
    list.forEach((b) => merged.set(b.id, b));
  }
  const nameQuery = (courtName || "").trim();
  if (nameQuery) {
    const list = await apiGet(`/api/bookings/search?courtName=${encodeURIComponent(nameQuery)}`);
    list.forEach((b) => merged.set(b.id, b));
  }
  return Array.from(merged.values());
}

/** Poll-based replacement for booking listeners on court QR pages. */
export function subscribeActiveCourtBooking({ courtId, courtName }, callback) {
  let courtLabel = courtName || "";

  return subscribePoll(
    async () => {
      if (courtId && !courtLabel) {
        courtLabel = (await fetchCourtName(courtId)) || courtLabel;
      }
      const bookings = await loadBookingsForCourt({ courtId, courtName: courtLabel || courtName });
      return findActiveBookingForCourt(bookings, courtId, new Date(), courtLabel || courtName);
    },
    callback,
    5000
  );
}

export function subscribeCourtOrdersForBooking(bookingId, callback) {
  if (!bookingId) return () => {};
  return subscribePoll(
    () => apiGet(`/api/court-orders?bookingId=${encodeURIComponent(bookingId)}`),
    callback,
    5000
  );
}
