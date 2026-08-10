import { roundMoney } from "./bookingMoney";
import { apiPost } from "./api";

/**
 * Upsert `customers` after a booking (increments counts, refreshes contact fields).
 */
export async function upsertCustomerAfterBooking(_db, payload) {
  const { userId, fullName, contactNumber, email, amountApplied } = payload;
  if (!userId) return;

  await apiPost("/api/customers/upsert", {
    userId,
    fullName,
    contactNumber,
    email,
    amountApplied: roundMoney(amountApplied),
  });
}
