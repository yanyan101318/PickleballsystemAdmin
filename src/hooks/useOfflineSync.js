import { useState, useEffect } from "react";
import toast from "react-hot-toast";

/**
 * Hook for wrapping API write operations with offline-aware status indicators.
 */
export function useOfflineSync() {
  const [syncState, setSyncState] = useState("idle"); 
  // "idle" | "syncing" | "offline-saved" | "reconnecting" | "success" | "error"

  useEffect(() => {
    const handleOnline = () => {
      if (syncState === "offline-saved") {
        setSyncState("reconnecting");
        // The backend handles the sync in the background automatically.
        // We do not await it here. The UI will just show reconnecting for a moment.
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncState]);

  const wrapSync = async (writePromise, options = {}) => {
    const {
      successMsg = "Synced Successfully",
      offlineMsg = "Saved Offline — Will Sync Automatically",
      errorMsg = "Sync Failed — Retry",
      onOfflineSuccess,
      onSuccess
    } = options;

    setSyncState(navigator.onLine ? "syncing" : "offline-saved");
    let isSynced = false;

    const raceLocal = new Promise((resolve) => {
      setTimeout(() => {
        if (!isSynced) {
          setSyncState("offline-saved");
          toast.success(offlineMsg);
          if (onOfflineSuccess) onOfflineSuccess();
          resolve("offline");
        }
      }, 1500);
    });

    try {
      const result = await Promise.race([
        writePromise.then(() => {
          isSynced = true;
          return "synced";
        }),
        raceLocal
      ]);

      if (result === "synced") {
        setSyncState("success");
        toast.success(successMsg);
        window.dispatchEvent(new Event("refresh-inventory"));
        if (onSuccess) onSuccess();
        setTimeout(() => setSyncState("idle"), 2000);
      } else {
        setTimeout(() => setSyncState("idle"), 3000); 
      }
      return result;
    } catch (err) {
      console.error(err);
      setSyncState("error");
      toast.error(errorMsg);
      setTimeout(() => setSyncState("idle"), 3000);
      throw err;
    }
  };

  return { syncState, wrapSync, setSyncState };
}
