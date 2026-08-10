import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Confetti from "react-confetti";

// Pickleball SVG
function PickleballSVG({ size = 40 }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" width={size} height={size}>
      <circle cx="20" cy="20" r="19" fill="#c8e63a" stroke="#a8c420" strokeWidth="1.5"/>
      {[[20,8],[20,32],[8,20],[32,20],[12,12],[28,12],[12,28],[28,28],[20,20]].map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r="2.2" fill="#7aaa00" opacity="0.75"/>
      ))}
      <ellipse cx="14" cy="13" rx="4" ry="2.5" fill="white" opacity="0.2" transform="rotate(-30 14 13)"/>
    </svg>
  );
}

export default function TournamentScoringPage() {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [otp, setOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [flashA, setFlashA] = useState(null);
  const [flashB, setFlashB] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Score states (server source of truth)
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [status, setStatus] = useState("Pending");
  const [winnerId, setWinnerId] = useState(null);

  // Game Settings & Server State
  const [endScore, setEndScore] = useState(() => parseInt(localStorage.getItem(`endScore_${matchId}`)) || 11);
  const [winByTwo, setWinByTwo] = useState(() => localStorage.getItem(`winByTwo_${matchId}`) !== 'false');
  const [servingTeam, setServingTeam] = useState(() => localStorage.getItem(`serveTeam_${matchId}`) || "A");
  const [serverNumber, setServerNumber] = useState(() => parseInt(localStorage.getItem(`serveNum_${matchId}`)) || 2);

  useEffect(() => {
    localStorage.setItem(`endScore_${matchId}`, endScore);
    localStorage.setItem(`winByTwo_${matchId}`, winByTwo);
    localStorage.setItem(`serveTeam_${matchId}`, servingTeam);
    localStorage.setItem(`serveNum_${matchId}`, serverNumber);
  }, [endScore, winByTwo, servingTeam, serverNumber, matchId]);

  useEffect(() => {
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const storedOtp = sessionStorage.getItem(`otp_${matchId}`);
    if (storedOtp) {
      verifyOtp(storedOtp);
    } else {
      fetchMatch();
    }
  }, [matchId]);

  useEffect(() => {
    if (!match?.division_id || !isVerified) return;
    const sse = new EventSource(`/api/tournaments-v2/sse/${match.division_id}`);
    sse.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'MATCH_UPDATE' && data.matchId === matchId) {
        fetchMatch();
      }
    };
    return () => sse.close();
  }, [match?.division_id, matchId, isVerified]);

  const showToast = (msg, type = "success") => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 2500);
  };

  const fetchMatch = async () => {
    try {
      const res = await axios.get(`/api/tournaments-v2/matches/${matchId}`);
      setMatch(res.data);
      setScoreA(res.data.score_a || 0);
      setScoreB(res.data.score_b || 0);
      setStatus(res.data.status || 'Pending');
      setWinnerId(res.data.winner_id);
    } catch (err) {
      console.error(err);
      showToast("Match not found", "error");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code) => {
    setLoading(true);
    try {
      await axios.post(`/api/tournaments-v2/matches/${matchId}/verify-otp`, { otp: code });
      setIsVerified(true);
      sessionStorage.setItem(`otp_${matchId}`, code);
      await fetchMatch();
    } catch (err) {
      showToast("Invalid OTP", "error");
      sessionStorage.removeItem(`otp_${matchId}`);
      setIsVerified(false);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (e) => {
    e.preventDefault();
    verifyOtp(otp);
  };

  const updateScore = async (newA, newB, newStatus, newWinner) => {
    setSaving(true);
    try {
      await axios.post(`/api/tournaments-v2/matches/${matchId}/score`, {
        score_a: newA,
        score_b: newB,
        status: newStatus,
        winner_id: newWinner
      });
      setScoreA(newA);
      setScoreB(newB);
      setStatus(newStatus);
      setWinnerId(newWinner);
    } catch (err) {
      showToast("Failed to update score", "error");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const triggerFlash = (side, type) => {
    if (side === "A") { setFlashA(type); setTimeout(() => setFlashA(null), 300); }
    else              { setFlashB(type); setTimeout(() => setFlashB(null), 300); }
  };

  const handlePoint = async (team) => {
    if (status === 'Completed' || saving) return;
    
    let newA = scoreA;
    let newB = scoreB;
    if (team === 'A') newA++;
    if (team === 'B') newB++;

    let newStatus = status === 'Pending' ? 'Ongoing' : status;
    let newWinner = winnerId;
    
    // Auto declare winner
    const winDiffA = newA - newB;
    const winDiffB = newB - newA;
    if (newA >= endScore && (!winByTwo || winDiffA >= 2)) {
       newStatus = 'Completed';
       newWinner = match.team_a_id;
    } else if (newB >= endScore && (!winByTwo || winDiffB >= 2)) {
       newStatus = 'Completed';
       newWinner = match.team_b_id;
    }
    
    try {
      await updateScore(newA, newB, newStatus, newWinner);
      triggerFlash(team, "plus");
    } catch (e) {
      console.error(e);
    }
  };

  const handleMinus = async (team) => {
    if (status === 'Completed' || saving) return;
    let newA = scoreA;
    let newB = scoreB;
    if (team === 'A' && newA > 0) newA--;
    if (team === 'B' && newB > 0) newB--;
    if (newA === scoreA && newB === scoreB) return;

    try {
      await updateScore(newA, newB, status, winnerId);
      triggerFlash(team, "minus");
    } catch (e) {
      console.error(e);
    }
  };

  const handleFault = () => {
    if (status === 'Completed') return;
    if (serverNumber === 1) {
      setServerNumber(2);
    } else {
      setServingTeam(prev => prev === "A" ? "B" : "A");
      setServerNumber(1);
    }
  };

  const toggleServer = () => {
    if (status === 'Completed') return;
    setServerNumber(prev => prev === 1 ? 2 : 1);
  };

  const toggleServingTeam = () => {
    if (status === 'Completed') return;
    setServingTeam(prev => prev === "A" ? "B" : "A");
  };

  if (loading) {
    return (
      <div className="sp-loading">
        <div className="sp-loading-ball"><PickleballSVG size={60}/></div>
        <p>Loading match...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="sp-loading"><p>Match not found.</p></div>
    );
  }

  if (!isVerified) {
    return (
      <div className="sp-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ background: 'var(--surface2)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border)', maxWidth: '400px', width: '90%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          <div className="sp-ball-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.2rem' }}><PickleballSVG size={50}/></div>
          <h2 style={{ color: 'var(--text)', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 800 }}>Scorer Access</h2>
          
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            Please enter the 6-digit OTP to access this match's scorer interface.
            <br/><span style={{fontSize: '0.8rem', opacity: 0.7}}>{match.tournament_name} • {match.division_name} {match.division_skill ? `(${match.division_skill})` : ''}</span>
          </p>
          <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
              placeholder="------"
              style={{ 
                fontSize: '2.5rem', textAlign: 'center', letterSpacing: '12px', padding: '1rem 0',
                background: 'rgba(0,0,0,0.3)', border: '2px solid var(--border)', borderRadius: '8px', color: 'var(--pickle)', fontWeight: 'bold', fontFamily: 'monospace', width: '100%' 
              }}
              autoFocus
            />
            <button type="submit" disabled={otp.length !== 6} style={{ 
              padding: '1rem', background: otp.length === 6 ? 'var(--pickle)' : 'rgba(200,230,58,0.3)', color: '#000', border: 'none', borderRadius: '8px', 
              fontSize: '1.1rem', fontWeight: 'bold', cursor: otp.length === 6 ? 'pointer' : 'not-allowed', marginTop: '0.5rem', transition: 'background 0.2s' 
            }}>
              Verify OTP
            </button>
          </form>
        </div>
        {toastMsg && (
          <div className={`sp-toast ${toastMsg.type==="error"?"sp-toast-err":"sp-toast-ok"}`}>
            {toastMsg.msg}
          </div>
        )}
      </div>
    );
  }

  const initials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase();
  };

  const isCompleted = status === 'Completed';
  const winnerName = winnerId === match.team_a_id ? match.team_a_name : (winnerId === match.team_b_id ? match.team_b_name : null);

  return (
    <div className="sp-page">
      {/* ── BACKGROUND ── */}
      <div className="sp-bg" aria-hidden="true">
        <svg className="sp-bg-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          {[15,30,45,60,75,90].map(y=>(
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#c8e63a" strokeWidth="0.2" opacity="0.06"/>
          ))}
          {[20,40,60,80].map(x=>(
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke="#c8e63a" strokeWidth="0.2" opacity="0.06"/>
          ))}
          <line x1="0" y1="50" x2="100" y2="50" stroke="#c8e63a" strokeWidth="0.5" opacity="0.1"/>
          <line x1="0" y1="22" x2="100" y2="22" stroke="#c8e63a" strokeWidth="0.3" opacity="0.08" strokeDasharray="2 3"/>
          <line x1="0" y1="78" x2="100" y2="78" stroke="#c8e63a" strokeWidth="0.3" opacity="0.08" strokeDasharray="2 3"/>
          <rect x="5" y="5" width="90" height="90" fill="none" stroke="#c8e63a" strokeWidth="0.4" opacity="0.08"/>
          <circle cx="50" cy="50" r="10" fill="none" stroke="#c8e63a" strokeWidth="0.3" opacity="0.06"/>
        </svg>
        {/* floating balls */}
        {[
          {x:8,y:15,s:32,d:12,dl:0},{x:88,y:20,s:24,d:9,dl:2},
          {x:5,y:70,s:40,d:15,dl:1},{x:90,y:75,s:28,d:11,dl:3},
          {x:50,y:5,s:20,d:8,dl:1.5},{x:45,y:92,s:36,d:13,dl:0.5},
        ].map((b,i)=>(
          <div key={i} className="sp-float-ball" style={{
            left:`${b.x}%`,top:`${b.y}%`,width:b.s,height:b.s,
            animationDuration:`${b.d}s`,animationDelay:`${b.dl}s`
          }}>
            <PickleballSVG size={b.s}/>
          </div>
        ))}
      </div>

      {/* ── HEADER ── */}
      <div className="sp-header">
        <div className="sp-header-left">
          <div className="sp-ball-icon"><PickleballSVG size={22}/></div>
          <div>
            <div className="sp-tournament-name">{match.tournament_name}</div>
            <div className="sp-match-meta">
              {match.division_name} {match.division_skill ? `(${match.division_skill})` : ''} · {match.match_type} {match.court ? `· Court: ${match.court}` : ''}
            </div>
          </div>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: "16px"}}>
          {!isCompleted && (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>End Score</span>
                <input 
                  type="number" 
                  value={endScore} 
                  onChange={e => setEndScore(parseInt(e.target.value) || 11)}
                  style={{width: '40px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)', borderRadius: '4px', color: 'white', textAlign: 'center', fontSize: '0.8rem', padding: '2px'}}
                />
              </div>
              <label style={{display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'}}>
                <input type="checkbox" checked={winByTwo} onChange={e => setWinByTwo(e.target.checked)} />
                <span style={{fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Win by 2</span>
              </label>
            </div>
          )}
          {saving ? (
            <div className="sp-saving-badge">
              <div className="sp-saving-dot"/>Saving...
            </div>
          ) : (
            <div className="sp-live-badge">{status === 'Completed' ? 'COMPLETED' : '● LIVE'}</div>
          )}
        </div>
      </div>

      {/* ── WINNER STATE ── */}
      {isCompleted && winnerId ? (
        <div className="sp-winner-screen">
          <Confetti width={windowSize.width} height={windowSize.height} recycle={false} numberOfPieces={300} />
          <div className="sp-winner-ball"><PickleballSVG size={80}/></div>
          <div className="sp-winner-trophy">🏆</div>
          <div className="sp-winner-name">{winnerName}</div>
          <div className="sp-winner-sub">wins the match!</div>
          <div className="sp-winner-sets" style={{marginTop: "20px"}}>
            <div className="sp-winner-set-chip chip-a" style={{background: 'rgba(0,0,0,0.5)', border: '1px solid var(--pickle)', color: 'white'}}>
              Final Score: {scoreA} – {scoreB}
            </div>
          </div>
        </div>
      ) : (
        <div className="sp-content">
          <div className="sp-scoreboard">
            {/* Team A */}
            <div className="sp-team-panel sp-team-a">
              <div className="sp-team-avatar sp-avatar-a" onClick={toggleServingTeam} style={{cursor: 'pointer'}}>{initials(match.team_a_name)}</div>
              <div className="sp-team-name">
                {servingTeam === 'A' && (
                  <div 
                    onClick={toggleServer}
                    style={{fontSize: "0.75rem", color: "var(--pickle)", marginBottom: "4px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", cursor: 'pointer'}}
                  >
                    🎾 {serverNumber === 1 ? '1st' : '2nd'} Server
                  </div>
                )}
                <div onClick={toggleServingTeam} style={{cursor: 'pointer'}}>{match.team_a_name || "TBD"}</div>
                <div style={{fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px"}}>{match.ta_p1} & {match.ta_p2}</div>
              </div>
              <div className={`sp-score-ring ${flashA==="plus"?"sp-flash-plus":flashA==="minus"?"sp-flash-minus":""}`}>
                <span className="sp-score-num">{scoreA}</span>
              </div>
              <div style={{width: "100%", marginTop: "12px", gap: "8px", display: "flex", flexDirection: "column"}}>
                <button 
                  className="sp-score-btn sp-btn-plus" 
                  onClick={() => handlePoint("A")} 
                  disabled={saving || isCompleted || servingTeam !== 'A'}
                  style={{width: "100%", fontSize: "1rem", opacity: servingTeam !== 'A' || isCompleted ? 0.3 : 1}}
                >
                  <span>POINT</span>
                </button>
                <button 
                  className="sp-score-btn sp-btn-minus" 
                  onClick={() => handleMinus("A")}
                  disabled={saving || isCompleted || scoreA === 0}
                  style={{width: "100%", fontSize: "0.85rem", opacity: scoreA === 0 || isCompleted ? 0.4 : 1}}
                >
                  <span>UNDO SCORE</span>
                </button>
              </div>
            </div>

            {/* Center VS & Fault */}
            <div className="sp-vs-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="sp-vs-text">VS</div>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <button 
                  className="sp-score-btn sp-btn-minus" 
                  onClick={handleFault}
                  disabled={saving || isCompleted}
                  style={{
                    width: "65px", fontSize: "0.75rem", padding: "6px", opacity: isCompleted ? 0.3 : 1, 
                    background: "linear-gradient(145deg, #3d1515, #2a0e0e)", border: "1px solid #ef444455", color: "#ef4444",
                    fontWeight: "bold", whiteSpace: "nowrap"
                  }}
                >
                  <span>⚠️ FAULT</span>
                </button>
              </div>
            </div>

            {/* Team B */}
            <div className="sp-team-panel sp-team-b">
              <div className="sp-team-avatar sp-avatar-b" onClick={toggleServingTeam} style={{cursor: 'pointer'}}>{initials(match.team_b_name)}</div>
              <div className="sp-team-name">
                {servingTeam === 'B' && (
                  <div 
                    onClick={toggleServer}
                    style={{fontSize: "0.75rem", color: "var(--pickle)", marginBottom: "4px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", cursor: 'pointer'}}
                  >
                    🎾 {serverNumber === 1 ? '1st' : '2nd'} Server
                  </div>
                )}
                <div onClick={toggleServingTeam} style={{cursor: 'pointer'}}>{match.team_b_name || "TBD"}</div>
                <div style={{fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px"}}>{match.tb_p1} & {match.tb_p2}</div>
              </div>
              <div className={`sp-score-ring ${flashB==="plus"?"sp-flash-plus":flashB==="minus"?"sp-flash-minus":""}`}>
                <span className="sp-score-num">{scoreB}</span>
              </div>
              <div style={{width: "100%", marginTop: "12px", gap: "8px", display: "flex", flexDirection: "column"}}>
                <button 
                  className="sp-score-btn sp-btn-plus" 
                  onClick={() => handlePoint("B")} 
                  disabled={saving || isCompleted || servingTeam !== 'B'}
                  style={{width: "100%", fontSize: "1rem", background: "linear-gradient(145deg, #2a1500, #1c0f00)", borderColor: "#f9731655", opacity: servingTeam !== 'B' || isCompleted ? 0.3 : 1}}
                >
                  <span>POINT</span>
                </button>
                <button 
                  className="sp-score-btn sp-btn-minus" 
                  onClick={() => handleMinus("B")}
                  disabled={saving || isCompleted || scoreB === 0}
                  style={{width: "100%", fontSize: "0.85rem", opacity: scoreB === 0 || isCompleted ? 0.4 : 1}}
                >
                  <span>UNDO SCORE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toastMsg && (
        <div className={`sp-toast ${toastMsg.type==="error"?"sp-toast-err":"sp-toast-ok"}`}>
          {toastMsg.msg}
        </div>
      )}
    </div>
  );
}
