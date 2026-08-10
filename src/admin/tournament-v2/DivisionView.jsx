import React, { useState } from "react";
import TeamList from "./TeamList";
import InitialBracketView from "./InitialBracketView";
import MedalBracketView from "./MedalBracketView";

export default function DivisionView({ division, tournament, onBack }) {
  const [activeTab, setActiveTab] = useState("teams");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-white p-2">
          &larr; Back
        </button>
        <div>
          <h1 className="text-2xl font-bold">{division.name}</h1>
          <p className="text-slate-400 text-sm">{tournament.name} • {division.gender} • {division.skill_level}</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-700 mb-6">
        <button 
          className={`pb-2 px-2 font-semibold ${activeTab === 'teams' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-300'}`}
          onClick={() => setActiveTab('teams')}
        >
          Teams
        </button>
        <button 
          className={`pb-2 px-2 font-semibold ${activeTab === 'initial' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-300'}`}
          onClick={() => setActiveTab('initial')}
        >
          Initial Bracket
        </button>
        <button 
          className={`pb-2 px-2 font-semibold ${activeTab === 'medal' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-slate-300'}`}
          onClick={() => setActiveTab('medal')}
        >
          Medal Bracket
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'teams' && <TeamList division={division} />}
        {activeTab === 'initial' && <InitialBracketView division={division} />}
        {activeTab === 'medal' && <MedalBracketView division={division} />}
      </div>
    </div>
  );
}
