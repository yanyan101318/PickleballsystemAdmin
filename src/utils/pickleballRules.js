// Pickleball Tournament Rules Documentation

export const PICKLEBALL_RULES = {
  scoring: {
    title: "🎯 Scoring Rules",
    description: "Official Pickleball Scoring",
    rules: [
      "Game is played to 11 points",
      "A team must win by at least 2 points",
      "If tied at 10–10, play continues until one team has a 2-point lead",
      "Examples: 11-9 (wins), 12-10 (wins), 11-10 (continues)",
      "Each team alternates serves, starting with Team A",
    ],
  },
  
  serving: {
    title: "🎾 Serving Rules (Doubles)",
    description: "Pickleball doubles serving sequence",
    rules: [
      "Both players on the serving team get to serve (except first service sequence)",
      "First serve of each side starts from the right-hand court (▶)",
      "After each point scored: server alternates sides (right ↔ left)",
      "Same server continues until a fault occurs",
      "On fault by first server: second server (partner) serves from their side",
      "On fault by second server: side-out (serve goes to opposing team)",
      "Opposing team's first server starts from the right-hand court",
    ],
  },
  
  singleServing: {
    title: "🎾 Serving Rules (Singles)",
    description: "Simplified serving for singles matches",
    rules: [
      "Serving player alternates serving sides after each point",
      "Start from right-hand court (▶) at beginning of game",
      "Continue until double fault (server loses serve)",
      "Opponent begins serving from right-hand court",
    ],
  },
  
  tournamentFormats: {
    title: "🏆 Tournament Formats",
    description: "Bracket structure options",
    formats: {
      singleElimination: {
        name: "Single Elimination",
        icon: "🔌",
        description: "One loss eliminates a team. Fastest format.",
        teams: "4-64 recommended",
      },
      doubleElimination: {
        name: "Double Elimination",
        icon: "⚔️",
        description: "Winners and losers brackets. Two losses eliminate a team.",
        teams: "4-32 recommended",
      },
      roundRobin: {
        name: "Round Robin",
        icon: "🔄",
        description: "All teams play each other. Rankings by total wins.",
        teams: "4-8 recommended",
      },
    },
  },
  
  matchFormats: {
    title: "🎮 Match Formats",
    description: "How many games to win",
    formats: {
      bo1: {
        name: "Single Game",
        description: "First team to win 1 game advances",
        bestOf: 1,
      },
      bo3: {
        name: "Best of 3",
        description: "First team to win 2 games advances",
        bestOf: 3,
      },
      bo5: {
        name: "Best of 5",
        description: "First team to win 3 games advances",
        bestOf: 5,
      },
    },
  },
  
  seeding: {
    title: "🎲 Seeding Options",
    description: "How teams are placed in brackets",
    options: {
      ordered: {
        name: "Ordered Seeding",
        icon: "📋",
        description: "Top-ranked plays lowest-ranked (1 vs 8, 2 vs 7, etc.)",
        use: "When team rankings are known",
      },
      random: {
        name: "Random Seeding",
        icon: "🎲",
        description: "Teams are shuffled randomly",
        use: "For casual or equal-skill tournaments",
      },
    },
  },
};

export function formatPointDisplay(scoreA, scoreB) {
  // Show current game score with context
  if (scoreA >= 11 || scoreB >= 11) {
    const diff = Math.abs(scoreA - scoreB);
    if (diff >= 2) {
      return `${scoreA}-${scoreB} (Game Won!)`;
    } else {
      return `${scoreA}-${scoreB} (Need 2-point lead)`;
    }
  }
  return `${scoreA}-${scoreB}`;
}

export function getServingInfo(servingTeam, servingSide, firstServer) {
  let info = `${servingTeam} serving`;
  
  if (servingSide === "right") {
    info += " from right ▶";
  } else {
    info += " from left ◀";
  }
  
  if (!firstServer) {
    info += " (2nd server)";
  }
  
  return info;
}
