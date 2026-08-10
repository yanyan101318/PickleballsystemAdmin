// src/admin/AnnouncementManager.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import Pagination from "./Pagination";
import Background from "../components/Background";

const TYPES = ["info","warning","success"];
const TYPE_ICONS = { info:"ℹ️", warning:"⚠️", success:"✅" };
const TYPE_COLORS = { 
  info: { border: "#3b82f6", bg: "#1e3a5f33", text: "#93c5fd" },
  warning: { border: "#f97316", bg: "#3b1f0033", text: "#fdba74" },
  success: { border: "#22c55e", bg: "#22c55e22", text: "#4ade80" }
};
const BLANK = { title:"", message:"", type:"info", is_active:true };

function AnnouncementCard({ announcement, onEdit, onToggle, onDelete, disabled }) {
  const colors = TYPE_COLORS[announcement.type] || TYPE_COLORS.info;
  return (
    <div className="an-card" style={{ borderLeft: `4px solid ${colors.border}` }}>
      <div className="an-card-header">
        <div className="an-card-type" style={{ background: colors.bg, color: colors.text }}>
          <span className="an-card-icon">{TYPE_ICONS[announcement.type]}</span>
          <span className="an-card-type-label">{announcement.type.toUpperCase()}</span>
        </div>
        <div className={`an-card-status ${announcement.is_active ? 'active' : 'inactive'}`}>
          {announcement.is_active ? '🟢 Active' : '🔒 Hidden'}
        </div>
      </div>
      
      <div className="an-card-body">
        <h3 className="an-card-title">{announcement.title}</h3>
        <p className="an-card-message">{announcement.message}</p>
      </div>
      
      <div className="an-card-footer">
        <div className="an-card-meta">
          <span>By {announcement.created_by ?? "Admin"}</span>
          <span className="an-card-date">
            {announcement.created_at
              ? new Date(announcement.created_at).toLocaleDateString("en-PH", {
                  month: "short", day: "numeric", year: "numeric"
                })
              : "Recently"}
          </span>
        </div>
        <div className="an-card-actions">
          <button className="an-card-btn an-card-btn-edit" onClick={() => onEdit(announcement)} disabled={disabled}> Edit</button>
          <button className="an-card-btn an-card-btn-toggle" onClick={() => onToggle(announcement)} disabled={disabled}>
            {announcement.is_active ? " Hide" : " Show"}
          </button>
          <button className="an-card-btn an-card-btn-delete" onClick={() => onDelete(announcement.id)} disabled={disabled}> Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementManager() {
  const { profile } = useAuth();
  const [items, setItems]   = useState([]);
  const [form, setForm]     = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  async function loadAnnouncements() {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error("Load announcements error:", err);
    }
  }

  useEffect(() => { loadAnnouncements(); }, []);

  function setf(k, v) { setForm(p => ({ ...p, [k]: v })); }
  function openAdd()   { setForm(BLANK); setEditId(null); setShowForm(true); }
  function openEdit(a) { setForm({ title: a.title, message: a.message, type: a.type, is_active: a.is_active }); setEditId(a.id); setShowForm(true); }
  function close()     { setShowForm(false); setEditId(null); }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        type: form.type,
        is_active: form.is_active,
        created_by: profile?.name || profile?.display_name || "Admin",
      };
      const res = editId
        ? await fetch(`/api/announcements/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/announcements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        await loadAnnouncements();
        close();
      }
    } catch (err) {
      console.error("Save announcement error:", err);
    }
    setSaving(false);
  }

  async function toggleActive(a) {
    try {
      await fetch(`/api/announcements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: a.title, message: a.message, type: a.type, is_active: !a.is_active }),
      });
      await loadAnnouncements();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this announcement?")) return;
    try {
      await fetch(`/api/announcements/${id}`, { method: "DELETE" });
      await loadAnnouncements();
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="page-with-bg">
      <Background />
      
      <div className="ad-page">
        <div className="ad-page-header">
          <div>
            <h1 className="ad-page-title">Announcements</h1>
            <p className="ad-page-sub">Post announcements visible to all players.</p>
          </div>
          <button className="ad-btn ad-btn-primary" onClick={openAdd}>+ New Announcement</button>
        </div>

        {items.length === 0 ? (
          <div className="an-empty-state">
            <div className="an-empty-icon">📢</div>
            <h3>No announcements yet</h3>
            <p>Create your first announcement to get started!</p>
            <button className="ad-btn ad-btn-primary" onClick={openAdd}>+ Create Announcement</button>
          </div>
        ) : (
          <>
            <div className="an-cards-grid">
              {pageItems.map(a => (
                <AnnouncementCard
                  key={a.id}
                  announcement={a}
                  onEdit={openEdit}
                  onToggle={toggleActive}
                  onDelete={handleDelete}
                  disabled={saving}
                />
              ))}
            </div>
            <Pagination page={safePage} totalPages={totalPages} onPage={setPage} />
          </>
        )}

        {showForm && (
          <div className="ad-modal-backdrop" onClick={e => e.target === e.currentTarget && close()}>
            <div className="ad-modal">
              <div className="ad-modal-header">
                <h3>{editId ? "Edit Announcement" : "New Announcement"}</h3>
                <button className="ad-modal-close" onClick={close}>✕</button>
              </div>
              <form className="ad-modal-form" onSubmit={handleSubmit}>
                <div className="af-group">
                  <label className="af-label">Title *</label>
                  <input className="af-input" value={form.title} onChange={e => setf("title", e.target.value)} placeholder="Announcement title" required />
                </div>
                <div className="af-group">
                  <label className="af-label">Message *</label>
                  <textarea className="af-input af-textarea" value={form.message} onChange={e => setf("message", e.target.value)} rows={4} placeholder="Announcement message..." required />
                </div>
                <div className="af-row">
                  <div className="af-group">
                    <label className="af-label">Type</label>
                    <div className="an-type-row">
                      {TYPES.map(t => (
                        <button key={t} type="button"
                          className={`an-type-btn an-type-${t} ${form.type === t ? "active" : ""}`}
                          onClick={() => setf("type", t)}
                          style={{ borderColor: TYPE_COLORS[t].border, color: form.type === t ? TYPE_COLORS[t].text : 'var(--text-muted)' }}>
                          {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="af-group">
                    <label className="af-label">Visibility</label>
                    <select className="af-input" value={String(form.is_active)} onChange={e => setf("is_active", e.target.value === "true")}>
                      <option value="true">🟢 Visible to players</option>
                      <option value="false">🔒 Hidden</option>
                    </select>
                  </div>
                </div>
                <div className="ad-modal-footer">
                  <button type="button" className="ad-btn ad-btn-outline" onClick={close} disabled={saving}>Cancel</button>
                  <button type="submit" className="ad-btn ad-btn-primary" disabled={saving}>
                    {saving ? "Saving..." : editId ? "Save Changes" : "Post Announcement"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}