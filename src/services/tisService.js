const CLOUD_URL = "/api/lights/cloud";
const DEVICES_URL = "/api/lights/devices";
const TIS_API_KEY = "a1e37bece88db231a5e29c96c64d01bda9e908cb8fb7f1670c87352f9f76100e4d4428fa076be148bdb81abc6753dfbaf899b6c3bd3dec85d585992d6cd0c4daaebe69a06ef6f84b";

export const COURT_DEVICE_IDS = {
  1: "26691934DDB4231401640ESW",
  2: "26691934DDB4231401640FSW",
  3: "26691934DDB42314016410SW",
  4: "26691934DDB4231401640DSW",
};

export function getDeviceId(courtId) {
  try {
    const o = JSON.parse(localStorage.getItem("pb_cloud_device_ids") || "{}");
    return o[courtId] || COURT_DEVICE_IDS[courtId] || "";
  } catch {
    return COURT_DEVICE_IDS[courtId] || "";
  }
}

export function saveDeviceId(courtId, deviceId) {
  let o = {};
  try { o = JSON.parse(localStorage.getItem("pb_cloud_device_ids") || "{}"); } catch {}
  o[courtId] = deviceId;
  localStorage.setItem("pb_cloud_device_ids", JSON.stringify(o));
}

export async function fetchCloudDevices() {
  const res = await fetch(DEVICES_URL, {
    method: "POST",
    headers: { apikey: TIS_API_KEY, "Content-Type": "application/json" },
  });
  const data = await res.json();
  return (data && data.status && data.status.devices) || [];
}

export async function sendLightCommand(courtId, state) {
  const level = state === "ON" ? 100 : 0;
  try {
    const res = await fetch(CLOUD_URL, {
      method: "POST",
      headers: { apikey: TIS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: getDeviceId(courtId), level, base_device_type: "light" }),
    });
    return { ok: res.ok };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export const sendAllLights = (courtIds, state) =>
  Promise.all(courtIds.map((c) => sendLightCommand(c, state)));
