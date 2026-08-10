import { apiGet, apiPost, subscribePoll } from "../../lib/api";
import { roundMoney } from "../../lib/bookingMoney";
import { PAYMENT_STATUS, CUSTOMER_ORDER_STATUS } from "../../marketplace/constants";

export function balanceDocRef(_userId) {
  return null;
}

export async function getCustomerBalance(userId) {
  return apiGet(`/api/customer-balances/${userId}`);
}

export function subscribeCustomerBalance(userId, callback) {
  if (!userId) return () => {};
  return subscribePoll(
    () => apiGet(`/api/customer-balances/${userId}`),
    (data) =>
      callback({
        outstandingBalance: roundMoney(data.outstandingBalance || 0),
        payLaterOrderIds: data.payLaterOrderIds || [],
      })
  );
}

export function subscribePayLaterOrders(userId, callback) {
  if (!userId) return () => {};
  return subscribePoll(async () => {
    const list = await apiGet(`/api/customer-orders?userId=${encodeURIComponent(userId)}`);
    return list
      .filter(
        (o) =>
          o.paymentStatus === PAYMENT_STATUS.BILLED ||
          o.status === CUSTOMER_ORDER_STATUS.BILLED
      )
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, callback);
}

export async function addToCustomerBalance(userId, customerOrderId, amount) {
  await apiPost(`/api/customer-balances/${userId}/add`, {
    customerOrderId,
    amount: roundMoney(amount),
  });
}

export async function settleCustomerBalance(userId, { amount, paymentMethod, cashierName, orderIds = [] }) {
  return apiPost(`/api/customer-balances/${userId}/settle`, {
    amount: roundMoney(amount),
    paymentMethod,
    cashierName,
    orderIds,
  });
}
