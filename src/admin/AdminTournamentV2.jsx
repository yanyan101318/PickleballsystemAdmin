import React, { useState } from "react";
import TournamentList from "./tournament-v2/TournamentList";
import TournamentDetail from "./tournament-v2/TournamentDetail";

export default function AdminTournamentV2() {
  const [selectedTournament, setSelectedTournament] = useState(null);

  return (
    <div className="h-full bg-[#0a0f18] text-white p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {!selectedTournament ? (
          <TournamentList onSelect={(t) => setSelectedTournament(t)} />
        ) : (
          <TournamentDetail 
            tournament={selectedTournament} 
            onBack={() => setSelectedTournament(null)} 
          />
        )}
      </div>
    </div>
  );
}
