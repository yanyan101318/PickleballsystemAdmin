export function normalizeInventoryItemType(value) {
  if (value == null) return "rental";
  const normalized = String(value).trim().toLowerCase();
  if (["for rent", "rental", "rent", "for_rent"].includes(normalized)) return "rental";
  if (["for sale", "sale", "sell", "for_sale"].includes(normalized)) return "sale";
  if (["both", "rent and sale", "rent_and_sale"].includes(normalized)) return "both";
  return "rental";
}

export function displayInventoryItemType(value) {
  const normalized = normalizeInventoryItemType(value);
  if (normalized === "sale") return "For Sale";
  if (normalized === "both") return "Both";
  return "For Rent";
}

export function isRentalInventoryItem(item) {
  const normalized = normalizeInventoryItemType(item?.type ?? item?.itemType);
  return normalized === "rental" || normalized === "both";
}

export function isSaleInventoryItem(item) {
  const normalized = normalizeInventoryItemType(item?.type ?? item?.itemType);
  return normalized === "sale" || normalized === "both";
}
