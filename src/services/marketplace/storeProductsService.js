import { apiGet, apiPost, apiPatch, apiDelete, subscribePoll } from "../../lib/api";
import { fileToProductImageBase64 } from "../../utils/productImage";

export function subscribeStoreProducts(storeId, callback) {
  if (!storeId) return () => {};
  return subscribePoll(
    () => apiGet(`/api/products?storeId=${encodeURIComponent(storeId)}`),
    callback
  );
}

export async function listStoreProducts(storeId) {
  return apiGet(`/api/products?storeId=${encodeURIComponent(storeId)}`);
}

export async function saveStoreProduct(storeId, productId, data, imageFile) {
  let productImage = data.productImage || data.existingImage || null;
  if (imageFile) {
    productImage = await fileToProductImageBase64(imageFile);
  }

  const payload = {
    name: String(data.name || "").trim(),
    description: String(data.description || "").trim(),
    category: String(data.category || "").trim(),
    price: Number(data.price) || 0,
    productImage,
    available: data.available !== false,
    stock: Math.max(0, Math.floor(Number(data.stock) || 0)),
    prepTimeMinutes: Math.max(0, Math.floor(Number(data.prepTimeMinutes) || 15)),
    storeId,
  };

  if (productId) {
    await apiPatch(`/api/products/${productId}`, payload);
    return { id: productId, storeId, ...payload };
  }

  const result = await apiPost("/api/products", payload);
  return { id: result.id, storeId, ...payload };
}

export async function deleteStoreProduct(_storeId, productId) {
  await apiDelete(`/api/products/${productId}`);
}

export function productStock(p) {
  const v = Number(p?.stock);
  return Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export function productPrice(p) {
  const v = Number(p?.price);
  return Number.isFinite(v) ? v : 0;
}
