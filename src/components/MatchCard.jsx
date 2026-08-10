// src/components/MatchCard.jsx
import { setsNeeded, setsTotal } from "../utils/bracketGenerator";

export default function MatchCard({ match, onClick }) {
  const { teamA, teamB, sets = [], winner, format, matchId } = match;
  const needed = setsNeeded(format);
  const total  = setsTotal(format);
  const winsA  = sets.filter(s => s.winner === "A").length;
  const winsB  = sets.filter(s => s.winner === "B").length;

  const isPending  = !teamA || !teamB;
  const isFinished = !!winner;
  const isLive     = !isFinished && sets.length > 0;

  function initials(name) {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function statusClass() {
    if (isFinished) return "mc-done";
    if (isLive)     return "mc-live";
    if (isPending)  return "mc-pending";
    return "mc-ready";
  }

  return (
    <div
      className={`match-card ${statusClass()}`}
      onClick={() => !isPending && onClick(match)}
      style={{ cursor: isPending ? "default" : "pointer" }}
    >
      {/* Top strip — match ID + live pill */}
      <div className="mc-topbar">
        <span className="mc-id">{matchId}</span>
        {isLive     && <span className="mc-pill pill-live">● LIVE</span>}
        {isFinished && <span className="mc-pill pill-done">✓ DONE</span>}
        {isPending  && <span className="mc-pill pill-wait">WAITING</span>}
        {!isPending && !isLive && !isFinished && <span className="mc-pill pill-ready">TAP TO SCORE</span>}
      </div>

      {/* Teams */}
      <div className="mc-teams">
        <TeamRow
          name={teamA || "TBD"}
          initials={initials(teamA)}
          wins={winsA}
          needed={needed}
          isWinner={winner === teamA}
          isLoser={!!winner && winner !== teamA}
          format={format}
          side="a"
        />

        {/* VS + set dots center */}
        <div className="mc-center">
          {format !== "bo1" ? (
            <div className="mc-set-dots">
              {Array.from({ length: total }).map((_, i) => {
                const s = sets[i];
                return <div key={i} className={`mc-dot ${s?.winner === "A" ? "dot-a" : s?.winner === "B" ? "dot-b" : "dot-empty"}`}/>;
              })}
            </div>
          ) : (
            <div className="mc-vs">VS</div>
          )}
          {format !== "bo1" && (
            <div className="mc-tally">{winsA}–{winsB}</div>
          )}
          {format === "bo1" && <div className="mc-vs-small">VS</div>}
        </div>

        <TeamRow
          name={teamB || "TBD"}
          initials={initials(teamB)}
          wins={winsB}
          needed={needed}
          isWinner={winner === teamB}
          isLoser={!!winner && winner !== teamB}
          format={format}
          side="b"
        />
      </div>

      {/* Winner ribbon */}
      {isFinished && (
        <div className="mc-winner-ribbon">
          <svg viewBox="0 0 14 14" fill="none" width="11" height="11">
            <circle cx="7" cy="7" r="6.5" fill="#c8e63a"/>
            {[[7,3],[7,11],[3,7],[11,7],[4.5,4.5],[9.5,4.5],[4.5,9.5],[9.5,9.5],[7,7]].map(([cx,cy],i)=>(
              <circle key={i} cx={cx} cy={cy} r="0.9" fill="#5a8800"/>
            ))}
          </svg>
          {winner} advances
        </div>
      )}
    </div>
  );
}

function TeamRow({ name, initials, wins, needed, isWinner, isLoser, format, side }) {
  return (
    <div className={`mc-team mc-team-${side} ${isWinner ? "team-win" : ""} ${isLoser ? "team-lose" : ""}`}>
      <div className={`mc-avatar mc-avatar-${side}`}>{initials}</div>
      <span className="mc-name">{name}</span>
      {format !== "bo1" && (
        <div className="mc-pips">
          {Array.from({ length: needed }).map((_, i) => (
            <span key={i} className={`mc-pip ${i < wins ? `pip-${side}` : ""}`}/>
          ))}
        </div>
      )}
    </div>
  );
}