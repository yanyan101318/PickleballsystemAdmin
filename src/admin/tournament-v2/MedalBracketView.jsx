import React, { useState, useEffect } from "react";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import Confetti from "react-confetti";

export default function MedalBracketView({ division }) {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [courts, setCourts] = useState([]);
  const [showGenModal, setShowGenModal] = useState(false);
  const [selectedScoringMatch, setSelectedScoringMatch] = useState(null);
  const [genForm, setGenForm] = useState({ format: "Single Elimination", endScore: "15", topN: "2", hasQuarterfinals: true });
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    fetchData();
    fetchCourts();
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);

    const sse = new EventSource(`/api/tournaments-v2/sse/${division.id}`);
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'MATCH_UPDATE') fetchData();
    };

    const intervalId = setInterval(() => {
      fetchData();
    }, 5000);

    return () => {
      window.removeEventListener('resize', handleResize);
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
      await axios.post(`/api/tournaments-v2/divisions/${division.id}/generate-medal`, genForm);
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

  const medalMatches = matches.filter(m => m.stage === 'medal');
  const initialMatches = matches.filter(m => m.stage === 'initial');
  const initialCompleted = initialMatches.length > 0 && initialMatches.every(m => m.status === 'Completed');

  // Find Winner
  let winner = null;
  const finalMatch = medalMatches.find(m => m.match_type === 'Final' || m.match_type === 'Elimination R1' && medalMatches.length===1); 
  // wait, the last match is 'Final'
  const realFinal = medalMatches.find(m => m.match_type === 'Final');
  if (realFinal && realFinal.status === 'Completed' && realFinal.winner_id) {
    winner = teams.find(t => t.id === realFinal.winner_id);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Medal Bracket</h2>
        <button 
          onClick={() => setShowGenModal(true)}
          disabled={!initialCompleted}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg shadow font-semibold"
          title={!initialCompleted ? "Complete all initial matches first" : ""}
        >
          Generate Medal Bracket
        </button>
      </div>

      {winner && (
        <div className="mb-8 p-8 bg-gradient-to-br from-amber-500/20 to-amber-700/20 border-2 border-amber-500/50 rounded-2xl text-center relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.2)]">
          <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={500} />
          <h2 className="text-4xl font-black text-amber-400 mb-2 drop-shadow-lg uppercase tracking-widest">Congratulations!</h2>
          <div className="text-lg text-amber-200/80 mb-6 font-semibold tracking-wide uppercase">Tournament Champions</div>
          
          <div className="inline-block bg-[#0a0f18]/80 backdrop-blur-md px-10 py-6 rounded-xl border border-amber-500/30">
            <h3 className="text-3xl font-bold text-white mb-2">{winner.team_name}</h3>
            <p className="text-xl text-slate-300">{winner.player1} & {winner.player2}</p>
          </div>
          
          {realFinal && (
            <div className="mt-6 text-sm font-bold text-amber-200/60 uppercase tracking-widest">
              Final Score: {realFinal.score_a} - {realFinal.score_b}
            </div>
          )}
        </div>
      )}

      {medalMatches.length === 0 ? (
        <div className="p-8 text-center bg-[#151e2d] border border-slate-700 rounded-xl text-slate-400">
          {!initialCompleted ? "Finish all initial matches to generate the medal bracket." : "Click Generate to create the medal bracket."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {medalMatches.map(m => (
            <div key={m.id} className="bg-[#151e2d] border border-amber-500/30 rounded-xl p-4 flex flex-col relative shadow">
              <div className="absolute top-3 right-3">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  m.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                  m.status === 'Ongoing' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'
                }`}>
                  {m.status}
                </span>
              </div>
              <div className="text-xs font-bold text-amber-500 mb-3 uppercase tracking-wide">{m.match_type}</div>
              
              <div className="flex-1 space-y-3 mb-4">
                <div className={`flex justify-between items-center p-2 rounded ${m.winner_id === m.team_a_id ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-800/50'}`}>
                  <div>
                    <div className="font-bold text-white text-sm">{m.team_a_name || 'TBD'}</div>
                    <div className="text-[10px] text-slate-400">{m.ta_p1} {m.ta_p2 ? `& ${m.ta_p2}`:''}</div>
                  </div>
                  <div className="font-bold text-lg text-amber-100">{m.score_a}</div>
                </div>
                <div className={`flex justify-between items-center p-2 rounded ${m.winner_id === m.team_b_id ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-slate-800/50'}`}>
                  <div>
                    <div className="font-bold text-white text-sm">{m.team_b_name || 'TBD'}</div>
                    <div className="text-[10px] text-slate-400">{m.tb_p1} {m.tb_p2 ? `& ${m.tb_p2}`:''}</div>
                  </div>
                  <div className="font-bold text-lg text-amber-100">{m.score_b}</div>
                </div>
              </div>

              <div className="flex items-end justify-between border-t border-slate-700 pt-3">
                <button 
                  onClick={() => setSelectedScoringMatch(m)}
                  className="bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-slate-600"
                >
                  Show Scoring Info
                </button>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">Court</div>
                    <select
                      value={m.court || ''}
                      onChange={(e) => handleCourtChange(m.id, e.target.value)}
                      className="bg-[#0a0f18] border border-slate-600 rounded px-2 py-1 text-xs text-white w-24 text-center focus:border-amber-500 outline-none"
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
      )}

      {showGenModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#151e2d] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-white">Setup Medal Bracket</h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Top N Teams per Group to Advance</label>
                <select value={genForm.topN} onChange={e => setGenForm({...genForm, topN: e.target.value})} className="w-full bg-[#0a0f18] border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none">
                  <option>2</option>
                  <option>3</option>
                  <option>4</option>
                  <option>5</option>
                </select>
              </div>
              <div className="flex items-center gap-2 my-2">
                <input type="checkbox" id="hasQtr" checked={genForm.hasQuarterfinals} onChange={e => setGenForm({...genForm, hasQuarterfinals: e.target.checked})} className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-amber-500 focus:ring-amber-500" />
                <label htmlFor="hasQtr" className="text-sm text-slate-300 cursor-pointer">Include Quarterfinals? (8 teams total)</label>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setShowGenModal(false)} className="px-4 py-2 text-slate-300 hover:text-white">Cancel</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg font-semibold shadow">Generate</button>
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
                <div className="font-mono text-amber-400 font-bold tracking-widest text-2xl">{selectedScoringMatch.otp}</div>
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
