import { apiGet, apiPost, apiPatch, subscribePoll, subscribeOne } from "../lib/api";

export async function createTournament(tournamentId, name, format, matchMap, tournamentFormat, scoringMode) {
  await apiPost("/api/tournaments", {
    tournamentId,
    name,
    format,
    tournamentFormat: tournamentFormat || "single-elimination",
    scoringMode: scoringMode === "rally" ? "rally" : "traditional",
    matchMap,
  });
}

export async function updateMatch(tournamentId, match) {
  await apiPatch(`/api/tournaments/${tournamentId}/matches/${match.matchId}`, sanitizeMatch(match));
}

export async function updateNextMatch(tournamentId, nextMatch) {
  await apiPatch(`/api/tournaments/${tournamentId}/matches/${nextMatch.matchId}`, sanitizeMatch(nextMatch));
}

export async function setChampion(tournamentId, champion) {
  await apiPatch(`/api/tournaments/${tournamentId}`, { champion });
}

export function subscribeToMatches(tournamentId, callback) {
  return subscribePoll(
    () => apiGet(`/api/tournaments/${tournamentId}/matches`),
    callback
  );
}

export function subscribeToMatch(tournamentId, matchId, callback) {
  return subscribeOne(
    () => apiGet(`/api/tournaments/${tournamentId}/matches`).then((matches) =>
      Object.entries(matches).map(([id, data]) => ({ id, ...data }))
    ),
    matchId,
    (match) => callback(match || null)
  );
}

export function subscribeToTournamentInfo(tournamentId, callback) {
  return subscribePoll(async () => {
    try {
      return await apiGet(`/api/tournaments/${tournamentId}`);
    } catch {
      return null;
    }
  }, callback);
}

export async function getTournamentInfo(tournamentId) {
  try {
    return await apiGet(`/api/tournaments/${tournamentId}`);
  } catch {
    return null;
  }
}

function sanitizeMatch(match) {
  const clean = {};
  for (const [k, v] of Object.entries(match)) {
    clean[k] = v === undefined ? null : v;
  }
  return clean;
}

export function generateTournamentId(name) {
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const rand = Math.random().toString(36).slice(2, 7);
  return `${slug}-${rand}`;
}

/** One-shot fetch for ScorerPage dynamic imports */
export async function getMatch(tournamentId, matchId) {
  try {
    return await apiGet(`/api/tournaments/${tournamentId}/matches/${matchId}`);
  } catch {
    return null;
  }
}
