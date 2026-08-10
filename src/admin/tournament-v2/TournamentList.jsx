import React, { useState, useEffect } from "react";
import axios from "axios";
import { Edit2, Trash2 } from "lucide-react";

export default function TournamentList({ onSelect }) {
  const [tournaments, setTournaments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", date: "", time: "", status: "Active" });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const res = await axios.get("/api/tournaments-v2");
      setTournaments(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put("/api/tournaments-v2/" + editingId, formData);
      } else {
        await axios.post("/api/tournaments-v2", formData);
      }
      setShowModal(false);
      setEditingId(null);
      fetchTournaments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (t) => {
    setFormData({ name: t.name, date: t.date || "", time: t.time || "", status: t.status });
    setEditingId(t.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this tournament?")) return;
    try {
      await axios.delete("/api/tournaments-v2/" + id);
      fetchTournaments();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tournaments (V2)</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg shadow font-semibold"
        >
          + Create Tournament
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.length === 0 ? (
          <div className="col-span-full text-center text-slate-500 py-10">No tournaments found</div>
        ) : (
          tournaments.map(t => (
            <div key={t.id} className="bg-[#151e2d] border border-slate-700 rounded-xl p-5 hover:border-cyan-500/50 transition-colors flex flex-col relative">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-xl font-bold text-white">{t.name}</h2>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(t)} className="text-slate-400 hover:text-cyan-400 p-1">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-slate-400 hover:text-red-400 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className={`px-2 py-1 rounded text-[11px] font-bold ${
                  t.status === 'Active' ? 'bg-emerald-500/20 text-emerald-400' :
                  t.status === 'Ongoing' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700 text-slate-300'
                }`}>
                  {t.status}
                </span>
                <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-[11px] font-bold">
                  {t.date ? new Date(t.date).toLocaleDateString() : 'TBD'} @ {t.time || 'TBD'}
                </span>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-700/50">
                <button 
                  onClick={() => onSelect(t)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold text-sm w-full text-left flex justify-between items-center"
                >
                  Manage Tournament <span>&rarr;</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-white">{editingId ? "Edit Tournament" : "Create Tournament"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Tournament Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">Date</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none [color-scheme:dark]" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">Time</label>
                  <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                  <option>Active</option>
                  <option>Ongoing</option>
                  <option>Finish</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setFormData({ name: "", date: "", time: "", status: "Active" }); }} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-semibold shadow">
                  {editingId ? "Save Changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
