/** Per-match prefs shared by Scorer Page and Score Modal (localStorage). */

export function getStoredScoringMode(matchId, tournamentDefault = "traditional") {
  try {
    const v = localStorage.getItem(`score_mode_${matchId}`);
    if (v === "rally" || v === "traditional") return v;
  } catch (_) {}
  return tournamentDefault === "rally" ? "rally" : "traditional";
}

export function setStoredScoringMode(matchId, mode) {
  try {
    localStorage.setItem(`score_mode_${matchId}`, mode);
  } catch (_) {}
}

export function getCourtSwap(matchId) {
  try {
    return localStorage.getItem(`court_swap_${matchId}`) === "1";
  } catch (_) {
    return false;
  }
}

export function setCourtSwap(matchId, swapped) {
  try {
    localStorage.setItem(`court_swap_${matchId}`, swapped ? "1" : "0");
  } catch (_) {}
}
