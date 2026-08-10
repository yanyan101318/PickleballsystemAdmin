// src/admin/CourtManager.jsx
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getEffectiveCourtStatus } from "../lib/bookingSlots";

const BLANK = { name: "", description: "", pricePerHour: "", amenities: "", isActive: true };

export default function CourtManager() {
  const [courts, setCourts] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [overrideModal, setOverrideModal] = useState(null);
  const [overrideType, setOverrideType] = useState("indefinite");
  const [overrideDuration, setOverrideDuration] = useState(2);
  const [overrideDatetime, setOverrideDatetime] = useState("");

  useEffect(() => {
    document.title = "PICKLE BROS COURT | Court Management";
  }, []);

  async function loadCourts() {
    try {
      const res = await fetch("/api/courts");
      if (res.ok) setCourts(await res.json());
    } catch (err) {
      console.error("Courts load error:", err);
    }
  }

  useEffect(() => { loadCourts(); }, []);

  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function openAdd() { setForm(BLANK); setEditId(null); setShowForm(true); }
  function openEdit(c) {
    setForm({
      ...c,
      amenities: Array.isArray(c.amenities) ? c.amenities.join(", ") : c.amenities ?? "",
      activeStartTime: c.activeStartTime || "06:00",
      activeEndTime: c.activeEndTime || "22:00"
    });
    setEditId(c.id); setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditId(null); }

  async function logCourtActivity(title, description) {
    try {
      await fetch("/api/activity-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
    } catch (err) {
      console.error("Activity log failed:", err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price_per_hour: Number(form.pricePerHour || form.price_per_hour),
      amenities: form.amenities.split(",").map(a => a.trim()).filter(Boolean),
      is_active: form.isActive !== undefined ? form.isActive : form.is_active,
      active_start_time: form.activeStartTime || form.active_start_time || "06:00",
      active_end_time: form.activeEndTime || form.active_end_time || "22:00",
    };
    try {
      let res;
      if (editId) {
        res = await fetch(`/api/courts/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/courts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      if (res && res.ok) {
        toast.success(editId ? "Court updated" : "Court added");
        logCourtActivity(
          editId ? "Court Updated" : "Court Added",
          `"${payload.name}" — ₱${payload.price_per_hour}/hr`
        );
        await loadCourts();
        closeForm();
      } else {
        toast.error("Could not save court");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not save court");
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this court?")) return;
    const name = courts.find((c) => c.id === id)?.name || "Court";
    try {
      const res = await fetch(`/api/courts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Court deleted");
        logCourtActivity("Court Deleted", `"${name}" was removed`);
        await loadCourts();
      } else {
        toast.error("Could not delete court");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not delete court");
    }
  }

  function openOverrideModal(court) {
    setOverrideModal(court);
    setOverrideType("indefinite");
    setOverrideDuration(2);
    setOverrideDatetime("");
  }
  function closeOverrideModal() {
    setOverrideModal(null);
  }

  async function handleOverrideSubmit(e) {
    e.preventDefault();
    if (!overrideModal) return;

    const nextStatus = !getEffectiveCourtStatus(overrideModal);
    let expiresAt = null;
    let newBaseStatus = overrideModal.base_status !== undefined ? overrideModal.base_status : overrideModal.isActive;
    let newOverrideStatus = null;

    if (overrideType === "indefinite") {
      newBaseStatus = nextStatus;
      newOverrideStatus = null;
    } else if (overrideType === "duration") {
      newOverrideStatus = nextStatus;
      expiresAt = new Date(Date.now() + overrideDuration * 3600 * 1000).toISOString();
    } else if (overrideType === "datetime") {
      newOverrideStatus = nextStatus;
      if (!overrideDatetime) { toast.error("Please select a date and time"); return; }
      const dt = new Date(overrideDatetime);
      if (dt <= new Date()) { toast.error("Please select a future date and time"); return; }
      expiresAt = dt.toISOString();
    }

    const payload = {
      base_status: typeof newBaseStatus === "boolean" ? newBaseStatus : nextStatus,
      override_status: newOverrideStatus,
      override_expires_at: expiresAt,
      is_active: typeof newBaseStatus === "boolean" ? newBaseStatus : nextStatus,
    };

    try {
      const res = await fetch(`/api/courts/${overrideModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(`Court ${nextStatus ? "activated" : "deactivated"}`);
        logCourtActivity("Court Status Changed", `"${overrideModal.name}" ${nextStatus ? "activated" : "deactivated"} (${overrideType})`);
        await loadCourts();
        closeOverrideModal();
      } else {
        toast.error("Could not update court status");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not update court status");
    }
  }

  const filtered = courts.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Court Management</h1>
          <p className="ad-page-sub">Add, edit, and manage your pickleball courts.</p>
        </div>
        <button className="ad-btn ad-btn-primary" onClick={openAdd}>+ Add Court</button>
      </div>

      {/* Search */}
      <div className="ad-search-row">
        <input className="ad-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courts..." />
        <span className="ad-count">{filtered.length} court{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Court grid */}
      <div className="cm-grid">
        {filtered.length === 0 && <div className="ad-empty">No courts found. Add your first court!</div>}
        {filtered.map(court => {
          const isEffectiveActive = getEffectiveCourtStatus(court);
          return (
            <div key={court.id} className={`cm-card ${isEffectiveActive ? "" : "cm-inactive"}`}>
              <div className="cm-card-header">
                <div className="flex items-center gap-2">
                  <div className="cm-card-name">{court.name}</div>
                  {court.hasPendingWrites && <span className="ad-badge ad-badge-pending text-[10px] px-1 py-0 border border-amber-500/20">Pending Sync</span>}
                </div>
                <div className={`ad-badge ${isEffectiveActive ? "ad-badge-approved" : "ad-badge-rejected"}`}>
                  {isEffectiveActive ? "Active" : "Inactive"}
                </div>
              </div>
              <div className="cm-price">₱{court.pricePerHour?.toLocaleString()}<span>/hour</span></div>
              <p className="cm-desc">{court.description || "No description."}</p>
              {court.amenities?.length > 0 && (
                <div className="cm-amenities">
                  {court.amenities.map((a, i) => (
                    <span key={i} className="cm-amenity-tag">{a}</span>
                  ))}
                </div>
              )}
              <div className="cm-actions">
                <button className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => openEdit(court)} disabled={saving}> Edit</button>
                <button className="ad-btn ad-btn-sm ad-btn-outline" onClick={() => openOverrideModal(court)} disabled={saving}>
                  {isEffectiveActive ? " Deactivate" : " Activate"}
                </button>
                <button className="ad-btn ad-btn-sm ad-btn-danger" onClick={() => handleDelete(court.id)} disabled={saving}>
                  {saving ? "..." : " Delete"}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="ad-modal-backdrop" onClick={e => e.target === e.currentTarget && closeForm()}>
          <div className="ad-modal">
            <div className="ad-modal-header">
              <h3>{editId ? "Edit Court" : "Add New Court"}</h3>
              <button className="ad-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="ad-modal-form" onSubmit={handleSubmit}>
              <div className="af-group">
                <label className="af-label">Court Name *</label>
                <input className="af-input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Court 1" required />
              </div>
              <div className="af-group">
                <label className="af-label">Description</label>
                <textarea className="af-input af-textarea" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Describe this court..." rows={3} />
              </div>
              <div className="af-row">
                <div className="af-group">
                  <label className="af-label">Price per Hour (₱) *</label>
                  <input className="af-input" type="number" min="0" value={form.pricePerHour} onChange={e => set("pricePerHour", e.target.value)} placeholder="200" required />
                </div>
                <div className="af-group">
                  <label className="af-label">Status</label>
                  <select className="af-input" value={form.isActive} onChange={e => set("isActive", e.target.value === "true")}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="af-group">
                <label className="af-label">Amenities <span style={{ fontWeight: 400, fontSize: "0.78rem" }}>(comma separated)</span></label>
                <input className="af-input" value={form.amenities} onChange={e => set("amenities", e.target.value)} placeholder="Lights, Water Station, Parking" />
              </div>
              <div className="ad-modal-footer">
                <button type="button" className="ad-btn ad-btn-outline" onClick={closeForm} disabled={saving}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editId ? "Save Changes" : "Add Court"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Override Modal */}
      {overrideModal && (
        <div className="ad-modal-backdrop" onClick={e => e.target === e.currentTarget && closeOverrideModal()}>
          <div className="ad-modal" style={{ maxWidth: "400px" }}>
            <div className="ad-modal-header">
              <h3>{getEffectiveCourtStatus(overrideModal) ? "Deactivate Court" : "Activate Court"}</h3>
              <button className="ad-modal-close" onClick={closeOverrideModal}>✕</button>
            </div>
            <form className="ad-modal-form" onSubmit={handleOverrideSubmit}>
              <div className="af-group">
                <label className="af-label">Duration Type</label>
                <select className="af-input" value={overrideType} onChange={e => setOverrideType(e.target.value)}>
                  <option value="indefinite">Indefinite (Permanent)</option>
                  <option value="duration">Set Duration (Hours)</option>
                  <option value="datetime">Custom Date and Time</option>
                </select>
              </div>

              {overrideType === "duration" && (
                <div className="af-group">
                  <label className="af-label">Hours</label>
                  <input type="number" min="0.5" step="0.5" className="af-input" value={overrideDuration} onChange={e => setOverrideDuration(Number(e.target.value))} required />
                </div>
              )}

              {overrideType === "datetime" && (
                <div className="af-group">
                  <label className="af-label">Revert Status At</label>
                  <input type="datetime-local" className="af-input" value={overrideDatetime} onChange={e => setOverrideDatetime(e.target.value)} required />
                </div>
              )}

              <div className="ad-modal-footer">
                <button type="button" className="ad-btn ad-btn-outline" onClick={closeOverrideModal} disabled={saving}>Cancel</button>
                <button type="submit" className="ad-btn ad-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}