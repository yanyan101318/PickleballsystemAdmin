import React, { useState, useEffect } from "react";
import axios from "axios";
import { Edit2, Trash2 } from "lucide-react";
import DivisionView from "./DivisionView";

export default function TournamentDetail({ tournament, onBack }) {
  const [divisions, setDivisions] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", gender: "Mixed", skill_level: "Beginner" });
  const [selectedDivision, setSelectedDivision] = useState(null);

  useEffect(() => {
    fetchDivisions();
  }, [tournament.id]);

  const fetchDivisions = async () => {
    try {
      const res = await axios.get(`/api/tournaments-v2/${tournament.id}/divisions`);
      setDivisions(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`/api/tournaments-v2/divisions/${editingId}`, formData);
      } else {
        await axios.post(`/api/tournaments-v2/${tournament.id}/divisions`, formData);
      }
      setShowModal(false);
      setEditingId(null);
      fetchDivisions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (div) => {
    setFormData({ name: div.name, gender: div.gender, skill_level: div.skill_level });
    setEditingId(div.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this division?")) return;
    try {
      await axios.delete(`/api/tournaments-v2/divisions/${id}`);
      fetchDivisions();
    } catch (err) {
      console.error(err);
    }
  };

  if (selectedDivision) {
    return <DivisionView division={selectedDivision} tournament={tournament} onBack={() => setSelectedDivision(null)} />;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="text-slate-400 hover:text-white p-2">
          &larr; Back
        </button>
        <div>
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <p className="text-slate-400 text-sm">Manage Divisions</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="ml-auto bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg shadow font-semibold"
        >
          + Add Division
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {divisions.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-[#151e2d] border border-slate-700 rounded-xl text-slate-400">
            No divisions found. Add one to get started.
          </div>
        ) : (
          divisions.map(div => (
            <div key={div.id} className="bg-[#151e2d] border border-slate-700 rounded-xl p-5 hover:border-cyan-500/50 transition-colors flex flex-col relative">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-white">{div.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(div)} className="text-slate-400 hover:text-cyan-400 p-1">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(div.id)} className="text-slate-400 hover:text-red-400 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 text-xs font-semibold mb-6">
                <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded">{div.gender}</span>
                <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded">{div.skill_level}</span>
              </div>
              <div className="mt-auto pt-4 border-t border-slate-700/50">
                <button 
                  onClick={() => setSelectedDivision(div)}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold text-sm w-full text-left flex justify-between items-center"
                >
                  Manage Teams & Brackets <span>&rarr;</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-white">{editingId ? "Edit Division" : "Add Division"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Division Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" placeholder="e.g. Open Doubles" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Gender</label>
                <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                  <option>Male</option>
                  <option>Female</option>
                  <option>Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Skill Level</label>
                <select value={formData.skill_level} onChange={e => setFormData({...formData, skill_level: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                  <option>Beginner</option>
                  <option>Novice Low</option>
                  <option>Novice High</option>
                  <option>Intermediate</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null); setFormData({ name: "", gender: "Mixed", skill_level: "Beginner" }); }} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-semibold shadow">
                  {editingId ? "Save Changes" : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
