// src/components/SetupForm.jsx
import { useState, useEffect } from "react";

const FORMAT_OPTIONS = [
  { value: "bo1", label: "Single Game", sub: "BO1", desc: "First win takes it" },
  { value: "bo3", label: "Best of 3",   sub: "BO3", desc: "First to win 2 sets" },
  { value: "bo5", label: "Best of 5",   sub: "BO5", desc: "First to win 3 sets" },
];

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── SVG elements for the background ──────────────────────

function PickleBall({ x, y, size, dur, delay, dx, dy, rot }) {
  return (
    <div className="bg-element pb-ball" style={{
      left: `${x}%`, top: `${y}%`, width: size, height: size,
      animationDuration: `${dur}s`, animationDelay: `${delay}s`,
      '--dx': `${dx}px`, '--dy': `${dy}px`, '--rot': `${rot}deg`,
    }}>
      <svg viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="19" fill="#c8e63a" stroke="#a8c420" strokeWidth="1.5"/>
        {[
          [20,8],[20,32],[8,20],[32,20],
          [12,12],[28,12],[12,28],[28,28],[20,20]
        ].map(([cx,cy],i) => (
          <circle key={i} cx={cx} cy={cy} r="2.2" fill="#7aaa00" opacity="0.75"/>
        ))}
        <ellipse cx="14" cy="13" rx="4" ry="2.5" fill="white" opacity="0.18" transform="rotate(-30 14 13)"/>
      </svg>
    </div>
  );
}

function Paddle({ x, y, size, dur, delay, dx, dy, rot, flip }) {
  return (
    <div className="bg-element pb-paddle" style={{
      left: `${x}%`, top: `${y}%`, width: size, height: size * 1.55,
      animationDuration: `${dur}s`, animationDelay: `${delay}s`,
      '--dx': `${dx}px`, '--dy': `${dy}px`, '--rot': `${rot}deg`,
      transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,
    }}>
      <svg viewBox="0 0 60 93" fill="none">
        {/* paddle head */}
        <ellipse cx="30" cy="32" rx="28" ry="30" fill="#2a5a3a" stroke="#1a3a28" strokeWidth="1.5"/>
        {/* paddle face texture lines */}
        <line x1="10" y1="20" x2="50" y2="20" stroke="#1a3a28" strokeWidth="0.8" opacity="0.5"/>
        <line x1="8"  y1="28" x2="52" y2="28" stroke="#1a3a28" strokeWidth="0.8" opacity="0.5"/>
        <line x1="8"  y1="36" x2="52" y2="36" stroke="#1a3a28" strokeWidth="0.8" opacity="0.5"/>
        <line x1="10" y1="44" x2="50" y2="44" stroke="#1a3a28" strokeWidth="0.8" opacity="0.5"/>
        {/* vertical lines */}
        <line x1="16" y1="8"  x2="16" y2="56" stroke="#1a3a28" strokeWidth="0.8" opacity="0.4"/>
        <line x1="24" y1="4"  x2="24" y2="60" stroke="#1a3a28" strokeWidth="0.8" opacity="0.4"/>
        <line x1="30" y1="2"  x2="30" y2="62" stroke="#1a3a28" strokeWidth="0.8" opacity="0.4"/>
        <line x1="36" y1="4"  x2="36" y2="60" stroke="#1a3a28" strokeWidth="0.8" opacity="0.4"/>
        <line x1="44" y1="8"  x2="44" y2="56" stroke="#1a3a28" strokeWidth="0.8" opacity="0.4"/>
        {/* accent stripe */}
        <ellipse cx="30" cy="32" rx="28" ry="30" fill="none" stroke="#c8e63a" strokeWidth="2" strokeDasharray="6 4" opacity="0.4"/>
        {/* neck */}
        <rect x="24" y="60" width="12" height="10" rx="3" fill="#1a2a1a" stroke="#111" strokeWidth="1"/>
        {/* handle */}
        <rect x="22" y="68" width="16" height="22" rx="5" fill="#8B4513" stroke="#5a2d0c" strokeWidth="1.2"/>
        {/* grip wrap lines */}
        <line x1="22" y1="74" x2="38" y2="74" stroke="#5a2d0c" strokeWidth="1.2" opacity="0.6"/>
        <line x1="22" y1="79" x2="38" y2="79" stroke="#5a2d0c" strokeWidth="1.2" opacity="0.6"/>
        <line x1="22" y1="84" x2="38" y2="84" stroke="#5a2d0c" strokeWidth="1.2" opacity="0.6"/>
        {/* butt cap */}
        <ellipse cx="30" cy="90" rx="9" ry="3.5" fill="#5a2d0c"/>
        {/* shine on head */}
        <ellipse cx="22" cy="20" rx="7" ry="4" fill="white" opacity="0.08" transform="rotate(-20 22 20)"/>
      </svg>
    </div>
  );
}

// Pickleball court top-down view
function Court({ x, y, scale, opacity, rotation }) {
  return (
    <div className="bg-element pb-court" style={{
      left: `${x}%`, top: `${y}%`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
      opacity,
    }}>
      <svg viewBox="0 0 280 560" fill="none" width="280" height="560">
        {/* outer court */}
        <rect x="2" y="2" width="276" height="556" rx="4" fill="none" stroke="#c8e63a" strokeWidth="2.5"/>
        {/* NVZ (kitchen) top */}
        <rect x="2" y="2" width="276" height="154" fill="#c8e63a" opacity="0.04"/>
        <line x1="2" y1="154" x2="278" y2="154" stroke="#c8e63a" strokeWidth="2"/>
        {/* NVZ (kitchen) bottom */}
        <rect x="2" y="406" width="276" height="152" fill="#c8e63a" opacity="0.04"/>
        <line x1="2" y1="406" x2="278" y2="406" stroke="#c8e63a" strokeWidth="2"/>
        {/* center line */}
        <line x1="140" y1="154" x2="140" y2="406" stroke="#c8e63a" strokeWidth="2" strokeDasharray="8 5"/>
        {/* net */}
        <rect x="0" y="272" width="280" height="16" fill="#c8e63a" opacity="0.08"/>
        <line x1="0" y1="280" x2="280" y2="280" stroke="#c8e63a" strokeWidth="3"/>
        {/* net posts */}
        <circle cx="0"   cy="280" r="5" fill="#c8e63a" opacity="0.5"/>
        <circle cx="280" cy="280" r="5" fill="#c8e63a" opacity="0.5"/>
        {/* center service line top half */}
        <line x1="140" y1="2" x2="140" y2="154" stroke="#c8e63a" strokeWidth="1.5" opacity="0.4"/>
        {/* center service line bottom half */}
        <line x1="140" y1="406" x2="140" y2="558" stroke="#c8e63a" strokeWidth="1.5" opacity="0.4"/>
      </svg>
    </div>
  );
}

const BG_BALLS = [
  { x:5,  y:10, size:38, dur:9,  delay:0,   dx:80,  dy:60,  rot:200 },
  { x:90, y:5,  size:28, dur:7,  delay:1.5, dx:-60, dy:80,  rot:150 },
  { x:15, y:80, size:45, dur:11, delay:0.5, dx:70,  dy:-50, rot:280 },
  { x:80, y:75, size:32, dur:8,  delay:3,   dx:-80, dy:-60, rot:320 },
  { x:50, y:15, size:24, dur:6,  delay:2,   dx:50,  dy:90,  rot:180 },
  { x:35, y:90, size:36, dur:10, delay:4,   dx:90,  dy:-70, rot:240 },
  { x:70, y:45, size:20, dur:7,  delay:1,   dx:-50, dy:60,  rot:160 },
  { x:92, y:55, size:42, dur:13, delay:2.5, dx:-90, dy:40,  rot:300 },
];

const BG_PADDLES = [
  { x:2,  y:30, size:70, dur:14, delay:0,   dx:50,  dy:30,  rot:-30, flip:false },
  { x:88, y:20, size:55, dur:12, delay:2,   dx:-40, dy:50,  rot:20,  flip:true  },
  { x:5,  y:65, size:65, dur:16, delay:1,   dx:60,  dy:-40, rot:15,  flip:false },
  { x:85, y:70, size:50, dur:11, delay:3,   dx:-50, dy:-30, rot:-25, flip:true  },
  { x:45, y:85, size:45, dur:13, delay:1.5, dx:30,  dy:-60, rot:45,  flip:false },
];

export default function SetupForm({ onStart }) {
  const [teamInput, setTeamInput] = useState("Team Alpha\nTeam Beta\nTeam Gamma\nTeam Delta");
  const [format, setFormat]       = useState("bo3");
  const [tournamentName, setTournamentName] = useState("");
  const [randomize, setRandomize] = useState(false);
  const [tournamentFormat, setTournamentFormat] = useState("single-elimination");
  const [scoringMode, setScoringMode] = useState("traditional");
  const [error, setError]         = useState("");
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 50); }, []);

  const teams      = teamInput.split("\n").map(t => t.trim()).filter(Boolean);
  const teamCount  = teams.length;
  const bracketSize = teamCount >= 2 ? nextPow2(teamCount) : 0;
  const byeCount   = bracketSize - teamCount;
  const matchCount = bracketSize - 1;

  function handleSubmit() {
    if (teamCount < 2) { setError("Please enter at least 2 teams."); return; }
    const unique = new Set(teams.map(t => t.toLowerCase()));
    if (unique.size !== teams.length) { setError("Duplicate team names found."); return; }
    setError("");
    onStart(tournamentName || "My Tournament", randomize ? shuffleArray(teams) : teams, format, tournamentFormat, scoringMode);
  }

  return (
    <div className="setup-landscape">

      {/* ── BACKGROUND LAYER ── */}
      <div className="pickle-bg" aria-hidden="true">

        {/* Courts */}
        <Court x={12}  y={50}  scale={0.55} opacity={0.07} rotation={-15}/>
        <Court x={88}  y={50}  scale={0.45} opacity={0.06} rotation={12} />
        <Court x={50}  y={15}  scale={0.35} opacity={0.05} rotation={0}  />
        <Court x={50}  y={88}  scale={0.30} opacity={0.04} rotation={5}  />

        {/* Paddles */}
        {BG_PADDLES.map((p, i) => <Paddle key={i} {...p} />)}

        {/* Balls */}
        {BG_BALLS.map((b, i) => <PickleBall key={i} {...b} />)}

        {/* Diagonal court line accents */}
        <svg className="bg-lines-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="0" y1="100" x2="100" y2="0" stroke="#c8e63a" strokeWidth="0.08" opacity="0.12"/>
          <line x1="0" y1="70"  x2="70"  y2="0" stroke="#c8e63a" strokeWidth="0.06" opacity="0.08"/>
          <line x1="30" y1="100" x2="100" y2="30" stroke="#c8e63a" strokeWidth="0.06" opacity="0.08"/>
        </svg>
      </div>

      {/* ── MAIN CARD ── */}
      <div className={`setup-landscape-card ${mounted ? "card-visible" : ""}`}>

        {/* LEFT PANEL */}
        <div className="setup-left-panel">
          <div className="slp-inner">
            <div className="slp-trophy">🏆</div>
            <h1 className="slp-title">Tournament<br/>Builder</h1>
            <p className="slp-sub">Pickleball Edition</p>
            <div className="slp-divider"/>
            <div className="slp-features">
              <div className="slp-feat"> Auto bracket generation</div>
              <div className="slp-feat"> Live multi-device scoring</div>
              <div className="slp-feat"> Random draw support</div>
              <div className="slp-feat"> BO1 · BO3 · BO5 formats</div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="setup-right-panel">

          <div className="ls-field">
            <label className="ls-label">Tournament Name</label>
            <input className="ls-input" value={tournamentName}
              onChange={e => setTournamentName(e.target.value)}
              placeholder="e.g. Pickleball Championship 2025"/>
          </div>

          <div className="ls-two-col">
            <div className="ls-field" style={{ flex:1 }}>
              <label className="ls-label">Teams <span className="ls-hint">· one per line · unlimited</span></label>
              <textarea className="ls-textarea" value={teamInput}
                onChange={e => setTeamInput(e.target.value)} rows={6}
                placeholder={"Team A\nTeam B\nTeam C\nTeam D"}/>
              {teamCount >= 2 ? (
                <div className="ls-preview">
                  <span><b>{teamCount}</b> teams</span>
                  <span className="ls-dot">·</span>
                  <span><b>{matchCount}</b> matches</span>
                  {byeCount > 0 && <><span className="ls-dot">·</span><span className="ls-bye"><b>{byeCount}</b> BYEs</span></>}
                </div>
              ) : <div className="ls-preview">Enter at least 2 teams</div>}
            </div>

            <div className="ls-right-col">
              <div className="ls-field">
                <label className="ls-label">Match Format</label>
                <div className="ls-format-list">
                  {FORMAT_OPTIONS.map(opt => (
                    <button key={opt.value}
                      className={`ls-fmt-btn ${format === opt.value ? "active" : ""}`}
                      onClick={() => setFormat(opt.value)}>
                      <span className="ls-fmt-badge">{opt.sub}</span>
                      <span className="ls-fmt-name">{opt.label}</span>
                      <span className="ls-fmt-desc">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ls-field">
                <label className="ls-label">Bracket Seeding</label>
                <div className="ls-seed-row">
                  <button className={`ls-seed-btn ${!randomize ? "active" : ""}`} onClick={() => setRandomize(false)}>
                    <span>📋</span> In Order
                  </button>
                  <button className={`ls-seed-btn ${randomize ? "active" : ""}`} onClick={() => setRandomize(true)}>
                    <span>🎲</span> Random
                  </button>
                </div>
              </div>

              <div className="ls-field">
                <label className="ls-label">Tournament Format</label>
                <div className="ls-format-row">
                  <button className={`ls-fmt-type-btn ${tournamentFormat === "single-elimination" ? "active" : ""}`} onClick={() => setTournamentFormat("single-elimination")}>
                    <span>🔌</span> Single Elimination
                  </button>
                  <button className={`ls-fmt-type-btn ${tournamentFormat === "double-elimination" ? "active" : ""}`} onClick={() => setTournamentFormat("double-elimination")}>
                    <span>⚔️</span> Double Elimination
                  </button>
                  <button className={`ls-fmt-type-btn ${tournamentFormat === "round-robin" ? "active" : ""}`} onClick={() => setTournamentFormat("round-robin")}>
                    <span>🔄</span> Round Robin
                  </button>
                </div>
              </div>

              <div className="ls-field">
                <label className="ls-label">Scoring</label>
                <div className="ls-format-row">
                  <button
                    type="button"
                    className={`ls-fmt-type-btn ${scoringMode === "traditional" ? "active" : ""}`}
                    onClick={() => setScoringMode("traditional")}
                  >
                    <span>🎯</span> Traditional Scoring
                  </button>
                  <button
                    type="button"
                    className={`ls-fmt-type-btn ${scoringMode === "rally" ? "active" : ""}`}
                    onClick={() => setScoringMode("rally")}
                  >
                    <span>⚡</span> Rally Scoring
                  </button>
                </div>
                <p className="ls-hint" style={{ marginTop: "8px", opacity: 0.85 }}>
                  Rally: point every rally · first to 21, win by 2 · change ends at 11
                </p>
              </div>
            </div>
          </div>

          {error && <div className="ls-error">⚠️ {error}</div>}

          <button className="ls-start-btn" onClick={handleSubmit}>
            {randomize ? "🎲 Random Draw & Generate" : "Generate Bracket"} →
          </button>
        </div>
      </div>
    </div>
  );
}

function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }