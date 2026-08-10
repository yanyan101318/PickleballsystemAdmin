import { apiGet, apiPatch, subscribePoll } from "../../lib/api";
import { roundMoney } from "../../lib/bookingMoney";
import { PAYOUT_STATUS } from "../../marketplace/constants";

export function subscribeVendorPayouts(callback) {
  return subscribePoll(() => apiGet("/api/vendor-payouts"), callback);
}

export async function markPayoutPaid(payoutId) {
  await apiPatch(`/api/vendor-payouts/${payoutId}`, {
    status: PAYOUT_STATUS.PAID,
  });
}

export async function getStoreSalesSummary(storeId) {
  const list = await apiGet("/api/customer-orders");
  let totalSales = 0;
  let orderCount = 0;
  let commission = 0;
  let net = 0;

  list.forEach((data) => {
    if (data.status !== "paid" && data.paymentStatus !== "paid") return;
    const block = (data.storeBreakdown || []).find((b) => b.storeId === storeId);
    if (!block) return;
    const settlement = (data.settlements || []).find((s) => s.storeId === storeId);
    orderCount += 1;
    totalSales = roundMoney(totalSales + (block.subtotal || 0));
    if (settlement) {
      commission = roundMoney(commission + (settlement.commission || 0));
      net = roundMoney(net + (settlement.vendorNet || 0));
    }
  });

  return { totalSales, orderCount, commission, net };
}
