/** Session flag set after successful admin code on login; clears after registration success. */

export const REGISTER_ACCESS_STORAGE_KEY = "picklepro_register_access_ok";

export function grantRegisterAccess() {
  try {
    sessionStorage.setItem(REGISTER_ACCESS_STORAGE_KEY, "1");
  } catch {
    /* quota / private mode */
  }
}

export function isRegisterAccessGranted() {
  try {
    return sessionStorage.getItem(REGISTER_ACCESS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearRegisterAccess() {
  try {
    sessionStorage.removeItem(REGISTER_ACCESS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
