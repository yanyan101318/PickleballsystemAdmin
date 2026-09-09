import React, { useState, useEffect } from 'react';
import { getDeviceId, saveDeviceId, fetchCloudDevices } from '../../services/tisService';

/**
 * Modal for editing per-court Cloud Device ID.
 *
 * Props:
 *   courtId   – 1-based court number (null = closed)
 *   courtName – display label e.g. "Court 1"
 *   onClose   – called when modal is dismissed
 *   onSaved   – called after save with (courtId)
 */
export default function CourtConfigModal({ courtId, courtName, onClose, onSaved }) {
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (courtId == null) return;
    
    setDeviceId(getDeviceId(courtId));

    const loadDevices = async () => {
      setLoading(true);
      try {
        const devs = await fetchCloudDevices();
        setDevices(devs || []);
      } catch (err) {
        console.error('Failed to fetch devices:', err);
      }
      setLoading(false);
    };
    
    loadDevices();
  }, [courtId]);

  if (courtId == null) return null;

  const handleSave = () => {
    saveDeviceId(courtId, deviceId);
    onSaved?.(courtId);
    onClose();
  };

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="court-cfg-title"
    >
      <div className="bg-[#121A24] border border-[#1E2A36] rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 id="court-cfg-title" className="text-[#F3F6FA] font-bold text-base flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-xl">edit</span>
            {courtName} — Cloud Device
          </h2>
          <button
            onClick={onClose}
            className="text-[#8FA1B3] hover:text-white transition-colors p-1 rounded"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[#8FA1B3] uppercase tracking-wider font-semibold">Select Device</span>
            {loading ? (
              <div className="text-sm text-[#8FA1B3]">Loading devices...</div>
            ) : (
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="bg-[#101820] border border-[#1E2A36] focus:border-cyan-500 outline-none text-[#F3F6FA] rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <option value="">-- Manual Entry --</option>
                {devices.map(dev => (
                  <option key={dev.device_id} value={dev.device_id}>
                    {dev.device_name} ({dev.room_name})
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[#8FA1B3] uppercase tracking-wider font-semibold">Custom Device ID</span>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="bg-[#101820] border border-[#1E2A36] focus:border-cyan-500 outline-none text-[#F3F6FA] rounded-lg px-3 py-2 text-sm transition-colors font-mono"
            />
          </label>
        </div>

        <p className="text-xs text-[#8FA1B3] leading-relaxed">
          The 2 hex digits before 'SW' are the channel (0D/0E/0F/10 = courts 4/1/2/3).
        </p>

        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-[#8FA1B3] hover:text-white bg-[#101820] border border-[#1E2A36] hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-900 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
