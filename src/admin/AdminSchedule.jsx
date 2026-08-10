// src/admin/AdminSchedule.jsx
import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";

function paymentDayKey(p) {
  if (!p.created_at) return null;
  const d = new Date(p.created_at);
  if (Number.isNaN(d.getTime())) return null;
  return format(d, "yyyy-MM-dd");
}

function normalizeBookingDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  }
  if (value instanceof Date) {
    return format(value, "yyyy-MM-dd");
  }
  return null;
}

export default function AdminSchedule() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedCourt, setSelectedCourt] = useState("All");

  const uniqueCourts = useMemo(() => {
    const courts = new Set();
    for (const b of bookings) {
      const courtName = b.courtName || b.court_name || b.courtId || "Court";
      courts.add(courtName);
    }
    return Array.from(courts).sort();
  }, [bookings]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        console.log("📅 Schedule: Fetching data...");
        const [resBookings, resTourneys] = await Promise.all([
          fetch("/api/bookings"),
          fetch("/api/tournaments-v2")
        ]);
        if (resBookings.ok) {
          const data = await resBookings.json();
          if (active) setBookings(data);
        } else {
          console.error("❌ Failed to fetch bookings:", resBookings.status);
        }
        if (resTourneys.ok) {
          const data = await resTourneys.json();
          if (active) setTournaments(data);
        } else {
          console.error("❌ Failed to fetch tournaments:", resTourneys.status);
        }
      } catch (err) {
        console.error("❌ Schedule load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    const handleRefresh = () => {
      load();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") load();
    };

    window.addEventListener("bookings:updated", handleRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const intervalId = window.setInterval(() => {
      load();
    }, 10000);

    return () => {
      active = false;
      window.removeEventListener("bookings:updated", handleRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, []);

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { bookingsByDate, paymentsByDate, tournamentsByDate, activities } = useMemo(() => {
    const bookingsByDateMap = new Map();
    for (const b of bookings) {
      const key = normalizeBookingDate(b.date || b.booking_date || b.bookingDate);
      if (!key) {
        console.warn("Booking missing date:", b);
        continue;
      }
      if (!bookingsByDateMap.has(key)) bookingsByDateMap.set(key, []);
      bookingsByDateMap.get(key).push(b);
    }

    const paymentsByDateMap = new Map();
    for (const p of payments) {
      const key = paymentDayKey(p);
      if (!key) continue;
      if (!paymentsByDateMap.has(key)) paymentsByDateMap.set(key, []);
      paymentsByDateMap.get(key).push(p);
    }

    const tournamentsByDateMap = new Map();
    for (const t of tournaments) {
      const key = normalizeBookingDate(t.date);
      if (!key) continue;
      if (!tournamentsByDateMap.has(key)) tournamentsByDateMap.set(key, []);
      tournamentsByDateMap.get(key).push(t);
    }

    const dayBookings = bookingsByDateMap.get(selected) ?? [];
    const dayPayments = paymentsByDateMap.get(selected) ?? [];
    const dayTournaments = tournamentsByDateMap.get(selected) ?? [];
    const rows = [];
    
    for (const b of dayBookings) {
      const timeSlot = b.timeSlot || b.time_slot || "00:00";
      const playerName = b.playerName || b.player_name || "Guest";
      const courtName = b.courtName || b.court_name || b.courtId || "Court";
      const duration = b.duration ? ` (${b.duration} hr${b.duration > 1 ? 's' : ''})` : "";
      const status = b.status || "Pending";
      
      rows.push({
        kind: "booking",
        sort: `${timeSlot}-${b.id}`,
        label: "Court booking",
        title: `${playerName} · ${courtName}`,
        sub: [`${timeSlot}${duration}`, `₱${b.totalAmount || 0}`, status].filter(Boolean).join(" · "),
        id: b.id,
      });
    }
    
    for (const p of dayPayments) {
      const ts = p.createdAt?.toDate?.() ?? null;
      const timeStr = ts ? format(ts, "h:mm a") : "";
      rows.push({
        kind: "payment",
        sort: `${timeStr}-${p.id}`,
        label: "Payment activity",
        title: `${p.name || "Customer"} · ₱${p.amount ?? "—"}`,
        sub: [p.method, p.paymentStatus, p.hasPendingWrites ? "Pending Sync" : null].filter(Boolean).join(" · "),
        id: p.id,
      });
    }
    
    for (const t of dayTournaments) {
      const timeSlot = t.time || "00:00 AM";
      rows.push({
        kind: "tournament",
        sort: `${timeSlot}-${t.id}`,
        label: "Tournament",
        title: t.name || "Tournament",
        sub: [`${timeSlot}`, t.status || "Active"].filter(Boolean).join(" · "),
        id: t.id,
      });
    }
    
    rows.sort((a, b) => a.sort.localeCompare(b.sort));

    return {
      bookingsByDate: bookingsByDateMap,
      paymentsByDate: paymentsByDateMap,
      tournamentsByDate: tournamentsByDateMap,
      activities: rows,
    };
  }, [bookings, payments, tournaments, selected]);

  if (loading) {
    return (
      <div className="ad-loading">
        <div className="ad-spinner" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <div className="ad-page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="ad-page-title">Schedule</h1>
          <p className="ad-page-sub">
            Calendar of customer court bookings and payment activity by day.
          </p>
        </div>
        <Link
          to="/admin/new-booking"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          New booking
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 ad-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <button
              type="button"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              onClick={() => setCursor(subMonths(cursor, 1))}
              aria-label="Previous month"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <h2 className="text-lg font-black text-white tracking-tight">
              {format(cursor, "MMMM yyyy")}
            </h2>
            <button
              type="button"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
              onClick={() => setCursor(addMonths(cursor, 1))}
              aria-label="Next month"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const inMonth = isSameMonth(day, cursor);
              const isSelected = selected === key;
              const bCount = (bookingsByDate.get(key) ?? []).length;
              const pCount = (paymentsByDate.get(key) ?? []).length;
              const tCount = (tournamentsByDate.get(key) ?? []).length;
              const hasActivity = bCount + pCount + tCount > 0;
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  className={`
                    relative min-h-[3rem] sm:min-h-[4rem] rounded-xl border text-left p-1.5 sm:p-2 transition-all
                    ${!inMonth ? "opacity-35 border-transparent bg-slate-900/20" : "border-slate-800 bg-slate-900/40"}
                    ${isSelected ? "ring-2 ring-cyan-500 border-cyan-500/50 bg-cyan-500/10" : "hover:border-slate-600"}
                    ${isToday && !isSelected ? "ring-1 ring-slate-600" : ""}
                  `}
                >
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      inMonth ? "text-white" : "text-slate-600"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {hasActivity && (
                    <div className="absolute bottom-1 left-1.5 right-1.5 flex flex-wrap gap-0.5 justify-center">
                      {bCount > 0 && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                          title={`${bCount} booking(s)`}
                        />
                      )}
                      {pCount > 0 && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-400"
                          title={`${pCount} payment(s)`}
                        />
                      )}
                      {tCount > 0 && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-purple-400"
                          title={`${tCount} tournament(s)`}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Bookings
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400" /> Tournaments
            </span>
          </div>
        </div>

        <div className="ad-card p-4 sm:p-6 flex flex-col min-h-[320px]">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-black text-white tracking-tight uppercase mb-1">
                {format(new Date(selected + "T12:00:00"), "EEEE, MMM d, yyyy")}
              </h3>
              {(() => {
                const dayBookings = (bookingsByDate.get(selected) ?? []);
                const filtered = selectedCourt === "All" ? dayBookings : dayBookings.filter(b => (b.courtName || b.court_name || b.courtId || "Court") === selectedCourt);
                if (filtered.length > 0) {
                  return (
                    <div className="text-[11px] text-slate-500">
                      · <span className="font-semibold text-emerald-400">{filtered.length}</span> bookings
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            {uniqueCourts.length > 0 && (
              <select
                className="bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg py-1.5 px-3 pr-8 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 appearance-none cursor-pointer hover:bg-slate-700 transition-colors shadow-sm"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                  backgroundPosition: `right 0.35rem center`,
                  backgroundRepeat: `no-repeat`,
                  backgroundSize: `1.2em 1.2em`,
                }}
                value={selectedCourt}
                onChange={e => setSelectedCourt(e.target.value)}
              >
                <option value="All">All Courts</option>
                {uniqueCourts.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[480px] custom-scrollbar pr-1">
            {activities.filter(a => a.kind === "booking" || a.kind === "tournament").filter(a => {
              if (a.kind === "tournament") return selectedCourt === "All";
              if (selectedCourt === "All") return true;
              const b = bookings.find(booking => booking.id === a.id);
              const courtName = b?.courtName || b?.court_name || b?.courtId || "Court";
              return courtName === selectedCourt;
            }).length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                <span className="material-symbols-outlined text-slate-700 text-3xl mb-2 block">
                  event_busy
                </span>
                <p className="text-slate-500 text-xs font-medium">
                  No bookings or tournaments match this filter.
                </p>
              </div>
            ) : (
              activities.filter(a => a.kind === "booking" || a.kind === "tournament").filter(a => {
                if (a.kind === "tournament") return selectedCourt === "All";
                if (selectedCourt === "All") return true;
                const b = bookings.find(booking => booking.id === a.id);
                const courtName = b?.courtName || b?.court_name || b?.courtId || "Court";
                return courtName === selectedCourt;
              }).sort((a, b) => {
                // Extract times and sort chronologically from AM to PM
                const timeA = a.sub.split(" · ")[0] || "00:00";
                const timeB = b.sub.split(" · ")[0] || "00:00";
                
                // Parse times like "02:00 PM (1.00 hr)" or "09:00 AM"
                const parseTime = (timeStr) => {
                  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
                  if (!match) return 0;
                  let [, hours, mins, period] = match;
                  hours = parseInt(hours);
                  mins = parseInt(mins);
                  if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
                  if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
                  return hours * 60 + mins;
                };
                
                return parseTime(timeA) - parseTime(timeB);
              }).map((a) => {
                if (a.kind === "tournament") {
                  return (
                    <div
                      key={`${a.kind}-${a.id}`}
                      className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30 hover:border-purple-500/50 transition-colors flex items-center gap-3"
                    >
                      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/20 border border-purple-500/40 flex-shrink-0">
                        <span className="material-symbols-outlined text-purple-400 text-lg">emoji_events</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white truncate">{a.title}</div>
                        <div className="text-xs text-purple-300 mt-0.5">{a.sub}</div>
                      </div>
                      <Link to="/admin/tournament-v2" className="flex items-center gap-2 flex-shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-semibold hover:bg-purple-500/30">
                          View
                        </span>
                      </Link>
                    </div>
                  );
                }

                const [timeSlot, amount, status] = a.sub.split(" · ");
                const b = bookings.find(booking => booking.id === a.id);
                const duration = b?.duration || 1;
                return (
                  <div
                    key={`${a.kind}-${a.id}`}
                    className="p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors flex items-center gap-3"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-700/60 border border-slate-600 flex-shrink-0">
                      <span className="material-symbols-outlined text-emerald-400 text-lg">sports_tennis</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{a.title}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{timeSlot}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        {duration * 60} min
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex gap-2">
            <Link
              to="/admin/bookings"
              className="flex-1 text-center py-2 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-colors"
            >
              All bookings
            </Link>
            <Link
              to="/admin/new-booking"
              className="flex-1 text-center py-2 rounded-lg bg-cyan-500/20 text-cyan-400 text-xs font-bold hover:bg-cyan-500/30 transition-colors"
            >
              Manual booking
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
