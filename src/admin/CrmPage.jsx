import { useState, useEffect, useMemo } from "react";
import { roundMoney } from "../lib/bookingMoney";
import Pagination from "./Pagination";

export default function CrmPage() {
  const [customers, setCustomers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function load() {
      try {
        const [custRes, bookRes] = await Promise.all([
          fetch("/api/customers"),
          fetch("/api/bookings"),
        ]);
        if (custRes.ok) setCustomers(await custRes.json());
        if (bookRes.ok) setBookings(await bookRes.json());
      } catch (err) {
        console.error("CRM load error:", err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const historyForSelected = useMemo(() => {
    if (!selected) return [];
    return bookings
      .filter((b) => {
        if (selected.user_id && (b.userId === selected.user_id || b.user_id === selected.user_id)) return true;
        if (selected.id && (b.userId === selected.id || b.user_id === selected.id)) return true;
        if (selected.email && b.email && selected.email.toLowerCase() === b.email.toLowerCase()) return true;
        if (selected.contact_number && (b.contactNumber === selected.contact_number || b.contact_number === selected.contact_number)) return true;
        if (selected.full_name && (b.playerName === selected.full_name || b.player_name === selected.full_name)) return true;
        return false;
      })
      .slice(0, 40);
  }, [bookings, selected]);

  const enrichedCustomers = useMemo(() => {
    return customers.map(c => {
      const cBookings = bookings.filter((b) => {
        if (c.user_id && (b.userId === c.user_id || b.user_id === c.user_id)) return true;
        if (c.id && (b.userId === c.id || b.user_id === c.id)) return true;
        if (c.email && b.email && c.email.toLowerCase() === b.email.toLowerCase()) return true;
        if (c.contact_number && (b.contactNumber === c.contact_number || b.contact_number === c.contact_number)) return true;
        if (c.full_name && (b.playerName === c.full_name || b.player_name === c.full_name)) return true;
        return false;
      });

      const validBookings = cBookings.filter(b => b.status !== "Rejected" && b.status !== "Cancelled");
      
      const calcSpent = validBookings.reduce((sum, b) => {
        return sum + Number(b.totalAmount ?? b.total_amount ?? b.amountPaid ?? b.amount_paid ?? 0);
      }, 0);

      return {
        ...c,
        total_bookings: validBookings.length,
        total_spent: calcSpent
      };
    });
  }, [customers, bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedCustomers.filter((c) => {
      const spent = Number(c.total_spent) || 0;
      const matchFilter =
        filter === "All" ||
        (filter === "Active" && (Number(c.total_bookings) || 0) > 0) ||
        (filter === "High value" && spent >= 5000);
      const matchSearch =
        !q ||
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.contact_number || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [enrichedCustomers, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function handleFilter(k) { setFilter(k); setPage(1); }
  function handleSearch(v) { setSearch(v); setPage(1); }

  if (loading) {
    return (
      <div className="ad-loading">
        <div className="ad-spinner" />
      </div>
    );
  }

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Customers (CRM)</h1>
          <p className="ad-page-sub">Profiles from the PostgreSQL customers table.</p>
        </div>
      </div>

      <div className="ad-filter-tabs">
        {["All", "Active", "High value"].map((k) => (
          <button key={k} type="button" className={`ad-filter-tab ${filter === k ? "active" : ""}`} onClick={() => handleFilter(k)}>
            {k}
          </button>
        ))}
      </div>

      <div className="ad-search-row">
        <input
          className="ad-search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search name, phone, or email…"
        />
        <span className="ad-count">
          {filtered.length} customer{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="ad-card">
        <div className="ad-table-wrap">
          <table className="ad-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Total spent</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="ad-empty">
                    No customers yet — they appear after the first booking.
                  </td>
                </tr>
              )}
              {pageRows.map((c) => (
                <tr key={c.id} className="ad-table-row cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="ad-td-main">{c.full_name ?? "—"}</td>
                  <td>{c.contact_number ?? "—"}</td>
                  <td>{c.email || "—"}</td>
                  <td>₱{roundMoney(Number(c.total_spent) || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />

      {selected && (
        <div className="ad-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="ad-modal ad-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="ad-modal-header">
              <h3>{selected.full_name}</h3>
              <button type="button" className="ad-modal-close" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className="ad-detail-grid">
              <div className="ad-detail-row">
                <span>Phone</span>
                <strong>{selected.contact_number ?? "—"}</strong>
              </div>
              <div className="ad-detail-row">
                <span>Email</span>
                <strong>{selected.email || "—"}</strong>
              </div>
              <div className="ad-detail-row">
                <span>Total spent</span>
                <strong>₱{roundMoney(Number(selected.total_spent) || 0).toFixed(2)}</strong>
              </div>
            </div>
            <h4 className="text-sm font-bold text-white mt-4 mb-2">Booking history</h4>
            <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="ad-table text-xs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Court</th>
                    <th>Total</th>
                    <th>Pay status</th>
                  </tr>
                </thead>
                <tbody>
                  {historyForSelected.length === 0 && (
                    <tr>
                      <td colSpan={4} className="ad-empty">No bookings for this profile.</td>
                    </tr>
                  )}
                  {historyForSelected.map((b) => (
                    <tr key={b.id}>
                      <td>{b.date ?? b.booking_date ?? "—"}</td>
                      <td>{b.courtName ?? b.court_name ?? b.courtId ?? b.court_id}</td>
                      <td>₱{roundMoney(Number(b.totalAmount ?? b.total_amount ?? b.amountPaid ?? b.amount_paid ?? 0)).toFixed(2)}</td>
                      <td className="capitalize">{b.customerPaymentStatus ?? b.customer_payment_status ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="ad-modal-footer">
              <button type="button" className="ad-btn ad-btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
