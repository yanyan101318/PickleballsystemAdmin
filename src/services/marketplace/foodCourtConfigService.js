import { apiGet, apiPut, subscribePoll } from "../../lib/api";
import { FOODCOURT_PATH } from "../../marketplace/constants";

const DEFAULT_CONFIG = {
  title: "RANAW Food Court",
  subtitle: "Scan to order from all stalls",
  publicPath: FOODCOURT_PATH,
};

export function foodCourtPublicUrl(origin = typeof window !== "undefined" ? window.location.origin : "") {
  return `${origin}${FOODCOURT_PATH}`;
}

export async function getFoodCourtConfig() {
  try {
    return await apiGet("/api/food-court-config");
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function subscribeFoodCourtConfig(callback) {
  return subscribePoll(() => apiGet("/api/food-court-config"), callback);
}

export async function saveFoodCourtConfig(data) {
  await apiPut("/api/food-court-config", {
    title: data.title || DEFAULT_CONFIG.title,
    subtitle: data.subtitle || "",
    publicPath: FOODCOURT_PATH,
  });
}
