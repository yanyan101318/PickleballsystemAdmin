import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { bookingMatchesCourt, parseBookingTimeRange } from '../lib/bookingSession';
import { isActiveBookingStatus } from '../lib/bookingSlots';
import {
  fetchCloudDevices,
  sendLightCommand,
  sendAllLights,
} from '../services/tisService';
import ManualControlPanel from '../components/lights/ManualControlPanel';
import CourtLightCard    from '../components/lights/CourtLightCard';
import SidePanels        from '../components/lights/SidePanels';
import CourtConfigModal  from '../components/lights/CourtConfigModal';



export default function Lights() {
  const [courts, setCourts]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activityLog, setActivityLog] = useState([]);

  // Connection state: null = checking, true = connected, false = offline
  const [cloudStatus, setCloudStatus] = useState(null);

  // Error / info toasts
  const [errorToast, setErrorToast] = useState(null);
  const [infoToast,  setInfoToast]  = useState(null);

  // Config-edit modal
  const [editingCourtId, setEditingCourtId] = useState(null);
  const [configVersion, setConfigVersion] = useState(0);

  const courtsRef = useRef(courts);
  useEffect(() => { courtsRef.current = courts; }, [courts]);

  const checkBookingsRef = useRef(null);

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const addLog = useCallback((message) => {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', second: '2-digit',
    });
    setActivityLog(prev =>
      [{ id: Date.now() + Math.random(), message, timestamp }, ...prev].slice(0, 50)
    );
  }, []);

  const showError = useCallback((msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  const showInfo = useCallback((msg) => {
    setInfoToast(msg);
    setTimeout(() => setInfoToast(null), 3000);
  }, []);

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleTisError = (e) => showError(e.detail.message);
    window.addEventListener('tis:error', handleTisError);
    return () => window.removeEventListener('tis:error', handleTisError);
  }, [showError]);

  useEffect(() => {
    (async () => {
      try {
        const devs = await fetchCloudDevices();
        setCloudStatus(Array.isArray(devs));
      } catch {
        setCloudStatus(false);
      }
      
      try {
        const res = await fetch('/api/courts');
        if (res.ok) {
          const courtsData = await res.json();
          const mappedCourts = courtsData.map((c, i) => ({
            id: c.id,
            name: c.name,
            deviceName: `Cloud Light ${i + 1}`,
            deviceId: '',
            isOn: false,
            autoEnabled: true
          }));
          setCourts(mappedCourts);
        } else {
          setCourts([]);
        }
      } catch (err) {
        console.error("Failed to fetch courts:", err);
        setCourts([]);
      }
      setLoading(false);
    })();
  }, []);

  // -------------------------------------------------------------------------
  // Booking Sync & Automation
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (loading) return;
    let isCancelled = false;

    const checkBookings = async () => {
      try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const res = await fetch(`/api/bookings?date=${todayStr}`);
        if (!res.ok) return;
        const bookings = await res.json();
        const now = new Date();

        if (isCancelled) return;

        let changed = false;
        const nextCourts = courtsRef.current.map(court => {
          const c = { ...court };
          
          const courtBookings = bookings.filter(b => 
            bookingMatchesCourt(b, c.id, c.name) && isActiveBookingStatus(b.status)
          );

          const parsed = courtBookings.map(b => {
            const range = parseBookingTimeRange(b);
            return range ? { booking: b, ...range } : null;
          }).filter(Boolean);

          const shouldBeOn = parsed.some(({ start, end }) => {
            const onTime = start.getTime() - 5 * 60 * 1000;
            const offTime = end.getTime() + 2 * 60 * 1000;
            return now.getTime() >= onTime && now.getTime() <= offTime;
          });

          const active = parsed.find(({ start, end }) => now >= start && now <= end);
          const upcoming = parsed.filter(({ start }) => start > now).sort((a, b) => a.start.getTime() - b.start.getTime())[0];
          
          let bookingText = 'Next Booking: None today';
          if (active) {
            const pName = (active.booking.playerName || active.booking.player_name || 'GUEST').toUpperCase();
            bookingText = `CURRENT BOOKING: ${active.booking.startTime} – ${active.booking.endTime} · ${pName}`;
          } else if (upcoming) {
            const pName = (upcoming.booking.playerName || upcoming.booking.player_name || 'GUEST').toUpperCase();
            bookingText = `NEXT BOOKING: ${upcoming.booking.startTime} – ${upcoming.booking.endTime} · ${pName}`;
          } else {
            bookingText = 'NEXT BOOKING: NONE TODAY';
          }
          
          if (c.bookingText !== bookingText) {
            c.bookingText = bookingText;
            changed = true;
          }

          if (c.autoEnabled && c.isOn !== shouldBeOn) {
            c.isOn = shouldBeOn;
            changed = true;
            
            sendLightCommand(c.id, shouldBeOn ? 'ON' : 'OFF').then(r => {
              const ok = r?.ok ?? false;
              addLog(`${c.name} · ${shouldBeOn ? 'ON' : 'OFF'} · ${ok ? 'OK' : 'FAIL'}`);
              if (!ok) showError(`Command failed`);
            }).catch(() => {});
          }
          return c;
        });
        
        if (changed) {
          setCourts(nextCourts);
        }
      } catch (err) {
        console.error('Failed to sync bookings:', err);
      }
    };

    checkBookingsRef.current = checkBookings;
    checkBookings();
    
    const handleRefresh = () => checkBookings();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkBookings();
    };

    window.addEventListener("bookings:updated", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const id = setInterval(checkBookings, 10000);
    return () => {
      isCancelled = true;
      clearInterval(id);
      window.removeEventListener("bookings:updated", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loading, addLog, showError]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleManualToggle = async (courtId, _deviceId, state) => {
    setCourts(prev => prev.map(c => c.id === courtId ? { ...c, isOn: state, autoEnabled: false } : c));
    const res = await sendLightCommand(courtId, state ? 'ON' : 'OFF');
    const ok = res?.ok ?? false;

    const court = courtsRef.current.find(c => c.id === courtId);
    const name = court ? court.name : `Court ${courtId}`;

    addLog(`${name} · ${state ? 'ON' : 'OFF'} · ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) showError(`Command failed`);
  };

  const handleAllToggle = async (state) => {
    setCourts(prev => prev.map(c => ({ ...c, isOn: state, autoEnabled: false })));
    const courtIds = courtsRef.current.map(c => c.id);
    const results = await sendAllLights(courtIds, state ? 'ON' : 'OFF');
    
    let anyFail = false;

    results.forEach((res, i) => {
      const court = courtsRef.current[i];
      const ok = res?.ok ?? false;
      if (!ok) anyFail = true;
      addLog(`${court.name} · ${state ? 'ON' : 'OFF'} · ${ok ? 'OK' : 'FAIL'}`);
    });
    
    if (anyFail) showError(`Command failed`);
  };

  const handleAutoAll = () => {
    setCourts(prev => prev.map(c => ({ ...c, autoEnabled: true })));
    addLog('Auto: Enabled for ALL courts');
  };

  const handleToggleAuto = (courtId, enabled) => {
    setCourts(prev => prev.map(c => c.id === courtId ? { ...c, autoEnabled: enabled } : c));
    const court = courtsRef.current.find(c => c.id === courtId);
    const name = court ? court.name : `Court ${courtId}`;
    addLog(`Auto: ${enabled ? 'Enabled' : 'Paused'} for ${name}`);
    
    if (enabled && checkBookingsRef.current) {
      setTimeout(() => checkBookingsRef.current(), 100);
    }
  };

  const handleEditCourt = (courtId) => setEditingCourtId(courtId);

  const handleConfigSaved = (courtId) => {
    setConfigVersion(v => v + 1);
    const court = courtsRef.current.find(c => c.id === courtId);
    const name = court ? court.name : `Court ${courtId}`;
    showInfo(`${name} device updated`);
    addLog(`Config: ${name} device updated`);
  };

  // -------------------------------------------------------------------------
  // Connection pill label
  // -------------------------------------------------------------------------
  const connPill = () => {
    if (cloudStatus === null) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[11px] font-extrabold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
          TIS CLOUD: CHECKING…
        </span>
      );
    }
    if (cloudStatus) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-extrabold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          TIS CLOUD: CONNECTED
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-extrabold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        OFFLINE
      </span>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return <div className="text-white p-8">Loading...</div>;
  }

  const editingCourt = courts.find(c => c.id === editingCourtId);

  return (
    <div className="flex flex-col gap-6 h-full text-[#F3F6FA] max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#1E2A36]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1">Lights</h1>
          <p className="text-[#8FA1B3] text-sm">Court light automation — manual and automatic control</p>
        </div>
        
        {/* Header Right Side */}
        <div className="flex items-center gap-4">
          {connPill()}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Main Column */}
        <div className="flex-1 flex flex-col gap-6 w-full">
          <ManualControlPanel
            onAllToggle={handleAllToggle}
            onAutoAll={handleAutoAll}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courts.map((court) => (
              <CourtLightCard
                key={`${court.id}-${configVersion}`}
                court={court}
                onToggleAuto={handleToggleAuto}
                onEditCourt={handleEditCourt}
                onManualToggle={handleManualToggle}
              />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <SidePanels activityLog={activityLog} />
      </div>

      {/* Config edit modal */}
      <CourtConfigModal
        courtId={editingCourtId}
        courtName={editingCourt ? editingCourt.name : `Court ${editingCourtId}`}
        onClose={() => setEditingCourtId(null)}
        onSaved={handleConfigSaved}
      />

      {/* Error Toast */}
      {errorToast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-red-600/90 border border-red-500 text-white text-sm font-semibold shadow-2xl backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-base">wifi_off</span>
          {errorToast}
        </div>
      )}

      {/* Info Toast (config saved, etc.) */}
      {infoToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl bg-cyan-700/90 border border-cyan-500 text-white text-sm font-semibold shadow-2xl backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-base">check_circle</span>
          {infoToast}
        </div>
      )}
    </div>
  );
}
