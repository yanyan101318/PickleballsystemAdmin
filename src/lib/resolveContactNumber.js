import { normalizePhilippineMsisdnNumber } from "./normalizePhilippinePhone.js";
import { apiGet } from "./api";

function pickPhone(...values) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s || s === "—" || /^n\/a$/i.test(s) || /@/.test(s)) continue;
    const normalized = normalizePhilippineMsisdnNumber(s);
    if (normalized != null) return normalized;
  }
  return null;
}

/**
 * Resolve a booking's contact phone: booking field, then users, then customers CRM.
 */
export async function resolveBookingContactNumber(_db, booking) {
  const fromBooking = pickPhone(booking?.contactNumber);
  if (fromBooking) return fromBooking;

  const userId = booking?.userId;
  if (!userId) return null;

  try {
    const data = await apiGet(`/api/users/${userId}/contact`);
    return pickPhone(data.phone, data.contactNumber);
  } catch (e) {
    console.error("resolveBookingContactNumber", e);
    return null;
  }
}
