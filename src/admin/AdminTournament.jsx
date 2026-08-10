import { useState, useEffect } from "react";
import SetupForm from "../components/SetupForm";
import BracketView from "../components/BracketView";
import { generateBracket, recordSetWin, undoLastSet } from "../utils/bracketGenerator";
import {
  createTournament, updateMatch, updateNextMatch,
  setChampion, generateTournamentId, subscribeToMatches,
  subscribeToTournamentInfo, getTournamentInfo,
} from "../services/tournamentService";
import { getStoredScoringMode } from "../utils/scoringModeStorage";

export default function AdminTournament() {
  const [tournament, setTournament] = useState(null);
  const [matchMap, setMatchMap] = useState({});
  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tournamentId, setTournamentId] = useState(() => {
    // Load persisted tournamentId from localStorage
    try {
      return localStorage.getItem('adminTournamentId') || null;
    } catch {
      return null;
    }
  });

  // Subscribe to tournament updates when tournament is loaded
  useEffect(() => {
    if (!tournamentId) return;

    const unsubInfo = subscribeToTournamentInfo(tournamentId, (data) => {
      setInfo(data);
    });
    const unsubMatches = subscribeToMatches(tournamentId, (matches) => {
      setMatchMap(matches);
      // Rebuild tournament rounds from updated matchMap
      if (tournament) {
        setTournament(prev => ({
          ...prev,
          rounds: rebuildRounds(Object.values(matches))
        }));
      }
    });

    return () => {
      unsubInfo();
      unsubMatches();
    };
  }, [tournamentId, tournament]);

  // Load tournament data when tournamentId is available
  useEffect(() => {
    if (!tournamentId) return;

    async function loadTournament() {
      try {
        const tournamentInfo = await getTournamentInfo(tournamentId);
        if (tournamentInfo) {
          setInfo(tournamentInfo);
          // Tournament will be rebuilt from matchMap subscription
        }
      } catch (err) {
        console.error('Failed to load tournament:', err);
      }
    }

    loadTournament();
  }, [tournamentId]);

  // Rebuild rounds from matchMap
  function rebuildRounds(matches) {
    if (!matches || matches.length === 0) return [];

    // Group matches by round
    const roundsMap = {};
    matches.forEach(match => {
      const round = match.round || 1;
      if (!roundsMap[round]) {
        roundsMap[round] = [];
      }
      roundsMap[round].push(match);
    });

    // Convert to array and sort rounds
    const rounds = [];
    const roundNumbers = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);
    roundNumbers.forEach(roundNum => {
      rounds.push(roundsMap[roundNum]);
    });

    return rounds;
  }

  async function handleStart(name, teams, format, tournamentFormat, scoringMode) {
    setSaving(true);
    try {
      const { rounds, matchMap } = generateBracket(teams, format, tournamentFormat);
      const tId = generateTournamentId(name);
      await createTournament(tId, name, format, matchMap, tournamentFormat, scoringMode);

      // Persist tournamentId to localStorage
      localStorage.setItem('adminTournamentId', tId);

      setTournamentId(tId);
      setTournament({ name, rounds, matchMap, format, tournamentFormat });
      setMatchMap(matchMap);
    } catch(err) {
      console.error(err);
      alert("Failed to save tournament.");
    }
    setSaving(false);
  }

  async function handleSetWin(match, winner, scoreA, scoreB) {
    const m = { ...matchMap[match.matchId] };
    const clonedMap = { ...matchMap, [m.matchId]: m };
    const mode = getStoredScoringMode(m.matchId, info?.scoringMode ?? "traditional");
    recordSetWin(m, winner, clonedMap, scoreA, scoreB, mode);

    try {
      // Save to the API
      await updateMatch(tournamentId, m);
      
      // Update next match in bracket based on tournament format
      if (m.winner) {
        // Single elimination
        if (m.nextMatchId) {
          await updateNextMatch(tournamentId, clonedMap[m.nextMatchId]);
        }
        // Double elimination winners bracket
        if (m.nextWinnerId) {
          await updateNextMatch(tournamentId, clonedMap[m.nextWinnerId]);
        }
        // Double elimination losers bracket
        if (m.nextLoserId) {
          await updateNextMatch(tournamentId, clonedMap[m.nextLoserId]);
        }
      }
      
      // If final match done, save champion
      if (m.winner && !m.nextMatchId && !m.nextWinnerId) {
        await setChampion(tournamentId, m.winner);
      }
    } catch (err) {
      console.error("Error saving set:", err);
      alert("Failed to save. Please try again.");
    }
  }

  async function handleUndo(match) {
    const m = { ...matchMap[match.matchId] };
    const hadWinner = !!m.winner;
    const nextId = m.nextMatchId;
    const clonedMap = { ...matchMap, [m.matchId]: m };
    undoLastSet(m, clonedMap);

    try {
      await updateMatch(tournamentId, m);
      if (hadWinner && nextId) {
        await updateNextMatch(tournamentId, clonedMap[nextId]);
      }
    } catch (err) {
      console.error("Error undoing set:", err);
      alert("Failed to undo. Please try again.");
    }
  }

  async function handlePersistMatch(match) {
    try {
      await updateMatch(tournamentId, match);
    } catch (err) {
      console.error("Error saving match:", err);
    }
  }

  if (saving) return (
    <div className="ad-loading">
      <div className="ad-spinner"/>
      <span>Creating tournament...</span>
    </div>
  );

  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {!tournamentId ? (
        <SetupForm onStart={handleStart}/>
      ) : !tournament && Object.keys(matchMap).length > 0 ? (
        // Reconstruct tournament from matchMap if we have data but no tournament object
        (() => {
          const rounds = rebuildRounds(Object.values(matchMap));
          const tournamentData = {
            name: info?.name || 'Tournament',
            rounds,
            matchMap,
            format: info?.format || 'bo3',
            tournamentFormat: info?.tournamentFormat || 'single-elimination'
          };
          setTournament(tournamentData);
          return null;
        })()
      ) : !tournament ? (
        <div className="ad-loading">
          <div className="ad-spinner"/>
          <span>Loading tournament...</span>
        </div>
      ) : (
        <BracketView
          tournamentName={tournament.name}
          rounds={tournament.rounds}
          format={tournament.format}
          tournamentId={tournamentId}
          scoringMode={info?.scoringMode ?? "traditional"}
          onSetWin={handleSetWin}
          onUndo={handleUndo}
          onPersistMatch={handlePersistMatch}
          onReset={() => {
            localStorage.removeItem('adminTournamentId');
            setTournament(null);
            setTournamentId(null);
            setMatchMap({});
            setInfo(null);
          }}
        />
      )}
    </div>
  );
}