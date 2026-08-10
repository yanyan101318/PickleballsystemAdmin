import React, { useState, useEffect } from "react";
import axios from "axios";

export default function TeamList({ division }) {
  const [teams, setTeams] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ player1: "", player2: "", club_name: "" });

  useEffect(() => {
    fetchTeams();
  }, [division.id]);

  const fetchTeams = async () => {
    try {
      const res = await axios.get(`/api/tournaments-v2/divisions/${division.id}/teams`);
      setTeams(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        team_name: `${formData.player1} & ${formData.player2}`
      };
      await axios.post(`/api/tournaments-v2/divisions/${division.id}/teams`, payload);
      setShowModal(false);
      setFormData({ player1: "", player2: "", club_name: "" });
      fetchTeams();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Registered Teams</h2>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg shadow font-semibold"
        >
          + Register Team
        </button>
      </div>

      <div className="bg-[#151e2d] border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#1c2636] border-b border-slate-700">
              <th className="p-4 font-semibold text-slate-300">Players</th>
              <th className="p-4 font-semibold text-slate-300">Club</th>
            </tr>
          </thead>
          <tbody>
            {teams.length === 0 ? (
              <tr>
                <td colSpan="2" className="p-6 text-center text-slate-500">No teams registered yet</td>
              </tr>
            ) : (
              teams.map(t => (
                <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors">
                  <td className="p-4 font-medium text-white">{t.player1} & {t.player2}</td>
                  <td className="p-4 text-slate-400">{t.club_name || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-white">Register Team</h2>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">Player 1</label>
                  <input required type="text" value={formData.player1} onChange={e => setFormData({...formData, player1: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">Player 2</label>
                  <input required type="text" value={formData.player2} onChange={e => setFormData({...formData, player2: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Club Name (Optional)</label>
                <input type="text" value={formData.club_name} onChange={e => setFormData({...formData, club_name: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-2 rounded-lg font-semibold shadow">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
