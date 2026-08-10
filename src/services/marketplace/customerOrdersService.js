import { apiGet, apiPost, apiPatch, subscribePoll, subscribeOne, tsToMs } from "../../lib/api";
import { roundMoney } from "../../lib/bookingMoney";
import {
  CUSTOMER_ORDER_STATUS,
  CUSTOMER_TYPE,
  PAYMENT_MODE,
  PAYMENT_STATUS,
  DISPATCH_STATUS,
  ORDER_SOURCE,
  VENDOR_ORDER_STATUS,
  PLATFORM_SERVICE_FEE_RATE,
} from "../../marketplace/constants";
import {
  shouldDispatchToVendorsOnCreate,
  initialOrderStatus,
  afterPosPaymentStatus,
  vendorPaymentBadgeForOrder,
} from "./orderEngine";
import { addToCustomerBalance } from "./customerBalanceService";

export function customerOrdersCollection() {
  return null;
}

function buildStoreBreakdown(storeGroups, serviceFeeRate) {
  const storeBreakdown = [];
  let subtotal = 0;
  for (const group of Object.values(storeGroups)) {
    const storeSubtotal = roundMoney(
      group.items.reduce((s, it) => s + roundMoney(it.lineTotal), 0)
    );
    subtotal = roundMoney(subtotal + storeSubtotal);
    storeBreakdown.push({
      storeId: group.storeId,
      storeName: group.storeName,
      items: group.items,
      subtotal: storeSubtotal,
    });
  }
  const fee = roundMoney(subtotal * serviceFeeRate);
  const grandTotal = roundMoney(subtotal + fee);
  return { storeBreakdown, subtotal, serviceFee: fee, grandTotal };
}

export async function dispatchVendorOrdersForCustomerOrder(customerOrder) {
  await apiPatch(`/api/customer-orders/${customerOrder.id}`, {
    dispatchStatus: DISPATCH_STATUS.DISPATCHED,
    dispatchedAt: new Date().toISOString(),
  });
  return customerOrder.vendorOrderIds || [];
}

export async function createFoodCourtOrder(params) {
  const {
    storeGroups,
    customerType = CUSTOMER_TYPE.GUEST,
    paymentMode = PAYMENT_MODE.PAY_NOW,
    customerName,
    guestPhone = null,
    userId = null,
    userEmail = null,
    bookingId = null,
    courtId = null,
    courtName = null,
    orderSource = ORDER_SOURCE.FOODCOURT,
    serviceFeeRate = PLATFORM_SERVICE_FEE_RATE,
  } = params;

  if (customerType === CUSTOMER_TYPE.GUEST && paymentMode === PAYMENT_MODE.PAY_LATER) {
    throw new Error("Guests must pay at the counter before orders are sent to vendors.");
  }

  const { storeBreakdown, subtotal, serviceFee, grandTotal } = buildStoreBreakdown(
    storeGroups,
    serviceFeeRate
  );

  const statusFields = initialOrderStatus({ customerType, paymentMode });
  const dispatchNow = shouldDispatchToVendorsOnCreate({ customerType, paymentMode });
  const badge = dispatchNow
    ? vendorPaymentBadgeForOrder({ ...statusFields, dispatchStatus: DISPATCH_STATUS.DISPATCHED })
    : null;

  const result = await apiPost("/api/customer-orders", {
    customerName: customerName || "Guest",
    customerType,
    paymentMode,
    orderSource,
    ...statusFields,
    storeBreakdown,
    subtotal,
    serviceFee,
    grandTotal,
    userId,
    userEmail,
    guestPhone,
    bookingId,
    courtId,
    courtName,
    dispatchNow,
    paymentBadge: badge,
    addToBalance: dispatchNow && !!userId,
  });

  return {
    customerOrderId: result.customerOrderId,
    grandTotal,
    vendorOrderIds: result.vendorOrderIds || [],
    ...statusFields,
  };
}

export async function createMarketplaceCustomerOrder(params) {
  const { bookingId, courtId, courtName, customerName, storeGroups, serviceFee = 0 } = params;
  const rate = serviceFee > 0 ? serviceFee / buildStoreBreakdown(storeGroups, 0).subtotal : PLATFORM_SERVICE_FEE_RATE;
  return createFoodCourtOrder({
    storeGroups,
    customerType: CUSTOMER_TYPE.GUEST,
    paymentMode: PAYMENT_MODE.PAY_NOW,
    customerName,
    bookingId,
    courtId,
    courtName,
    orderSource: ORDER_SOURCE.COURT_QR,
    serviceFeeRate: Number.isFinite(rate) ? rate : PLATFORM_SERVICE_FEE_RATE,
  });
}

export function subscribeMarketplaceOrders(callback) {
  return subscribePoll(() => apiGet("/api/customer-orders"), callback);
}

export function subscribePendingCustomerOrders(callback) {
  return subscribeMarketplaceOrders((list) => {
    const pending = list.filter(
      (o) =>
        o.dispatchStatus === DISPATCH_STATUS.BLOCKED &&
        (o.paymentStatus === PAYMENT_STATUS.PENDING ||
          o.status === CUSTOMER_ORDER_STATUS.AWAITING_PAYMENT ||
          o.status === CUSTOMER_ORDER_STATUS.PENDING_PAYMENT)
    );
    callback(pending);
  });
}

export function subscribeCustomerOrder(orderId, callback) {
  return subscribeOne(() => apiGet("/api/customer-orders"), orderId, callback);
}

export async function rejectCustomerOrder(orderId) {
  await apiPatch(`/api/customer-orders/${orderId}`, {
    status: CUSTOMER_ORDER_STATUS.REJECTED,
  });
}

export async function payCustomerOrderAtPos({
  customerOrder,
  paymentMethod,
  cashierName,
  commissionByStore,
}) {
  const settlements = [];
  let totalCommission = 0;
  let totalVendorNet = 0;

  for (const block of customerOrder.storeBreakdown || []) {
    const rate = Number(commissionByStore?.[block.storeId]) || 0;
    const gross = roundMoney(block.subtotal);
    const commission = roundMoney(gross * (rate / 100));
    const vendorNet = roundMoney(gross - commission);
    totalCommission = roundMoney(totalCommission + commission);
    totalVendorNet = roundMoney(totalVendorNet + vendorNet);
    settlements.push({
      storeId: block.storeId,
      storeName: block.storeName,
      gross,
      commissionRate: rate,
      commission,
      vendorNet,
    });
  }

  return apiPost(`/api/customer-orders/${customerOrder.id}/pay-at-pos`, {
    paymentMethod,
    cashierName,
    settlements,
    totalCommission,
    totalVendorNet,
  });
}

export async function updateVendorOrderStatus(storeId, vendorOrderId, status) {
  await apiPatch(`/api/vendor-orders/${storeId}/${vendorOrderId}`, {
    status,
    adjustStock: status === VENDOR_ORDER_STATUS.COMPLETED,
  });
}

export async function markVendorOrderTransferred(storeId, vendorOrderId) {
  await apiPatch(`/api/vendor-orders/${storeId}/${vendorOrderId}`, {
    transferredAt: new Date().toISOString(),
  });
}

export function subscribeVendorOrders(storeId, callback, { vendorVisibleOnly = true } = {}) {
  if (!storeId) return () => {};
  return subscribePoll(async () => {
    let list = await apiGet(`/api/vendor-orders?storeId=${encodeURIComponent(storeId)}`);
    if (vendorVisibleOnly) {
      list = list.filter((o) => o.visibleToVendor !== false && o.paymentBadge !== "BLOCKED");
    }
    return list;
  }, callback);
}

export async function listDispatchedVendorOrdersForStores(storeIds) {
  const all = [];
  for (const storeId of storeIds) {
    const list = await apiGet(`/api/vendor-orders?storeId=${encodeURIComponent(storeId)}`);
    list.forEach((o) => {
      if (o.visibleToVendor !== false && o.paymentBadge !== "BLOCKED") {
        all.push(o);
      }
    });
  }
  all.sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));
  return all;
}
