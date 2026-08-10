import { apiGet, apiPost, apiPatch, apiDelete, subscribePoll } from "../../lib/api";
import { generateSecureToken, vendorPortalUrl } from "./tokenUtils";
import { STORE_STATUS } from "../../marketplace/constants";
import { fileToProductImageBase64 } from "../../utils/productImage";

export function storesCollection() {
  return null;
}

export function storeDocRef(_storeId) {
  return null;
}

export function storeProductsCollection(_storeId) {
  return null;
}

export function vendorOrdersCollection(_storeId) {
  return null;
}

function mapStoreList(list, activeOnly) {
  let result = [...list];
  if (activeOnly) {
    result = result.filter((s) => s.status === STORE_STATUS.ACTIVE);
  }
  result.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return result;
}

export async function listStores({ activeOnly = false } = {}) {
  const list = await apiGet("/api/stores");
  return mapStoreList(list, activeOnly);
}

export function subscribeStores(callback, { activeOnly = false } = {}) {
  return subscribePoll(
    async () => mapStoreList(await apiGet("/api/stores"), activeOnly),
    callback
  );
}

export async function getStore(storeId) {
  try {
    return await apiGet(`/api/stores/${storeId}`);
  } catch {
    return null;
  }
}

export async function validateVendorToken(storeId, token) {
  if (!storeId || !token) return { ok: false, error: "Missing credentials" };
  const result = await apiPost("/api/vendor/validate-token", { storeId, token });
  return result;
}

export async function uploadStoreLogo(_storeId, file) {
  return fileToProductImageBase64(file);
}

export async function createStore(payload) {
  const result = await apiPost("/api/stores", {
    name: String(payload.name || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    contactNumber: String(payload.contactNumber || "").trim(),
    stallNumber: String(payload.stallNumber || "").trim(),
    category: payload.category || "food",
    commissionRate: Number(payload.commissionRate) || 0,
    logoUrl: payload.logoUrl || null,
    status: payload.status || STORE_STATUS.ACTIVE,
    token: generateSecureToken(),
  });

  const portalUrl = vendorPortalUrl(result.id, result.token);
  await apiPatch(`/api/stores/${result.id}`, { portalUrl });

  return {
    id: result.id,
    storeId: result.id,
    name: payload.name,
    ownerName: payload.ownerName,
    contactNumber: payload.contactNumber,
    stallNumber: payload.stallNumber,
    category: payload.category || "food",
    commissionRate: Number(payload.commissionRate) || 0,
    logoUrl: payload.logoUrl || null,
    status: payload.status || STORE_STATUS.ACTIVE,
    vendorTokenId: result.tokenId,
    portalPath: result.portalPath,
    token: result.token,
    portalUrl,
  };
}

export async function updateStore(storeId, patch) {
  await apiPatch(`/api/stores/${storeId}`, patch);
}

export async function deleteStore(storeId) {
  await apiDelete(`/api/stores/${storeId}`);
}

export async function rotateVendorToken(storeId) {
  const result = await apiPost(`/api/stores/${storeId}/rotate-token`, {});
  const portalUrl = vendorPortalUrl(storeId, result.token);
  await apiPatch(`/api/stores/${storeId}`, { portalUrl });
  return { token: result.token, portalUrl };
}
