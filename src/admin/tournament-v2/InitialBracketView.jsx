import React, { useState, useEffect } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";

export default function InitialBracketView({ division }) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [courts, setCourts] = useState([]);
  const [showGenModal, setShowGenModal] = useState(false);
  const [selectedScoringMatch, setSelectedScoringMatch] = useState(null);
  const [genForm, setGenForm] = useState({ format: "Round Robin", endScore: "11", groups: "1" });
  const [viewTab, setViewTab] = useState("bracket"); // bracket | matches
  
  useEffect(() => {
    fetchData();
    fetchCourts();
    
    // Listen for SSE updates (realtime)
    const sse = new EventSource(`/api/tournaments-v2/sse/${division.id}`);
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'MATCH_UPDATE') {
         fetchData();
      }
    };

    // Fallback polling every 5 seconds to ensure scores stay in sync if SSE fails
    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      sse.close();
      clearInterval(intervalId);
    };
  }, [division.id]);

  const fetchData = async () => {
    try {
      const [mRes, tRes] = await Promise.all([
        axios.get(`/api/tournaments-v2/divisions/${division.id}/matches`),
        axios.get(`/api/tournaments-v2/divisions/${division.id}/teams`)
      ]);
      setMatches(mRes.data || []);
      setTeams(tRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCourts = async () => {
    try {
      const res = await axios.get('/api/courts');
      setCourts(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`/api/tournaments-v2/divisions/${division.id}/generate-initial`, genForm);
      setShowGenModal(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate");
    }
  };

  const handleCourtChange = async (matchId, court) => {
    try {
      await axios.post(`/api/tournaments-v2/matches/${matchId}/court`, { court });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const initialMatches = matches.filter(m => m.stage === 'initial');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Initial Bracket</h2>
        <button 
          onClick={() => setShowGenModal(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg shadow font-semibold"
        >
          Generate Bracket
        </button>
      </div>

      {initialMatches.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button className={`px-4 py-1.5 rounded-full text-sm font-bold ${viewTab==='bracket'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-400'}`} onClick={() => setViewTab('bracket')}>Bracket View</button>
          <button className={`px-4 py-1.5 rounded-full text-sm font-bold ${viewTab==='matches'?'bg-cyan-600 text-white':'bg-slate-800 text-slate-400'}`} onClick={() => setViewTab('matches')}>Match View</button>
        </div>
      )}

      {initialMatches.length === 0 ? (
        <div className="p-8 text-center bg-[#151e2d] border border-slate-700 rounded-xl text-slate-400">
          No bracket generated yet. Click Generate to start.
        </div>
      ) : (
        viewTab === 'bracket' ? (
          <div className="space-y-6">
            {/* Group teams by bracket_group and sort by wins, diff */}
            {Array.from(new Set(initialMatches.map(m => m.bracket_group))).map(group => {
              const groupTeamsIds = new Set();
              initialMatches.filter(m => m.bracket_group === group).forEach(m => {
                if(m.team_a_id) groupTeamsIds.add(m.team_a_id);
                if(m.team_b_id) groupTeamsIds.add(m.team_b_id);
              });
              const groupTeams = teams.filter(t => groupTeamsIds.has(t.id)).sort((a,b) => {
                if(b.wins !== a.wins) return b.wins - a.wins;
                return b.point_diff - a.point_diff;
              });

              return (
                <div key={group} className="bg-[#151e2d] border border-slate-700 rounded-xl overflow-hidden shadow">
                  <div className="bg-[#1c2636] p-3 font-bold text-white border-b border-slate-700">Group {group}</div>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-700/50 text-slate-400 text-sm">
                        <th className="p-3">Rank</th>
                        <th className="p-3">Team</th>
                        <th className="p-3">W</th>
                        <th className="p-3">L</th>
                        <th className="p-3">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupTeams.map((t, idx) => (
                        <tr key={t.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                          <td className="p-3 font-bold text-cyan-400">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-semibold text-white">{t.team_name}</div>
                            <div className="text-xs text-slate-400">{t.player1} & {t.player2}</div>
                          </td>
                          <td className="p-3 font-bold text-emerald-400">{t.wins}</td>
                          <td className="p-3 font-bold text-red-400">{t.losses}</td>
                          <td className="p-3 font-bold text-blue-400">{t.point_diff > 0 ? `+${t.point_diff}` : t.point_diff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {initialMatches.map(m => (
              <div key={m.id} className="bg-[#151e2d] border border-slate-700 rounded-xl p-4 flex flex-col relative shadow">
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    m.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    m.status === 'Ongoing' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {m.status}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-400 mb-3">{division.skill_level} • {m.match_type} • Group {m.bracket_group} • Round {m.match_round}</div>
                
                <div className="flex-1 space-y-3 mb-4">
                  <div className={`flex justify-between items-center p-2 rounded ${m.winner_id === m.team_a_id ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-slate-800/50'}`}>
                    <div>
                      <div className="font-bold text-white text-sm">{m.team_a_name || 'TBD'}</div>
                      <div className="text-[10px] text-slate-400">{m.ta_p1} {m.ta_p2 ? `& ${m.ta_p2}`:''}</div>
                    </div>
                    <div className="font-bold text-lg">{m.score_a}</div>
                  </div>
                  <div className={`flex justify-between items-center p-2 rounded ${m.winner_id === m.team_b_id ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-slate-800/50'}`}>
                    <div>
                      <div className="font-bold text-white text-sm">{m.team_b_name || 'TBD'}</div>
                      <div className="text-[10px] text-slate-400">{m.tb_p1} {m.tb_p2 ? `& ${m.tb_p2}`:''}</div>
                    </div>
                    <div className="font-bold text-lg">{m.score_b}</div>
                  </div>
                </div>

                <div className="flex items-end justify-between border-t border-slate-700 pt-3">
                  <button 
                    onClick={() => setSelectedScoringMatch(m)}
                    className="bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600"
                  >
                    Show Scoring Info
                  </button>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Court</div>
                    <select
                      value={m.court || ''}
                      onChange={(e) => handleCourtChange(m.id, e.target.value)}
                      className="bg-[#0a0f18] border border-slate-600 rounded px-2 py-1 text-xs text-white w-24 text-center focus:border-cyan-500 outline-none"
                    >
                      <option value="">Assign...</option>
                      {courts.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {showGenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-white">Setup Initial Bracket</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Format</label>
                <select value={genForm.format} onChange={e => setGenForm({...genForm, format: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                  <option>Round Robin</option>
                  <option>Single Elimination</option>
                  <option>Double Elimination</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm text-slate-400 mb-1">End Score</label>
                  <select value={genForm.endScore} onChange={e => setGenForm({...genForm, endScore: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                    <option>11</option>
                    <option>15</option>
                    <option>21</option>
                    <option>25</option>
                  </select>
                </div>
                {genForm.format === 'Round Robin' && (
                  <div className="flex-1">
                    <label className="block text-sm text-slate-400 mb-1">Groups</label>
                    <input type="number" min="1" value={genForm.groups} onChange={e => setGenForm({...genForm, groups: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none" />
                  </div>
                )}
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowGenModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-semibold shadow">Generate</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedScoringMatch && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-8 relative flex flex-col items-center text-center">
            <button 
              onClick={() => setSelectedScoringMatch(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-xl"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-2 text-white">Scoring Info</h2>
            <p className="text-sm text-slate-400 mb-6">Scan QR code or use OTP to enter scores.</p>
            
            <div className="bg-white p-4 rounded-xl mb-6 shadow-inner">
              <QRCodeSVG value={`${window.location.origin}/scoring/${selectedScoringMatch.id}`} size={160} />
            </div>
            
            <div className="w-full">
              <div className="text-[10px] text-slate-500 font-bold uppercase mb-2">Match OTP</div>
              <div className="flex items-center justify-center gap-3 bg-slate-800 rounded-lg p-3 border border-slate-600">
                <div className="font-mono text-cyan-400 font-bold tracking-widest text-2xl">{selectedScoringMatch.otp}</div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await axios.post(`/api/tournaments-v2/matches/${selectedScoringMatch.id}/refresh-otp`);
                      setSelectedScoringMatch({...selectedScoringMatch, otp: res.data.otp});
                      fetchData();
                    } catch(e) {
                      console.error(e);
                    }
                  }}
                  className="bg-slate-700 hover:bg-slate-600 p-2 rounded-md transition-colors"
                  title="Refresh OTP"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
