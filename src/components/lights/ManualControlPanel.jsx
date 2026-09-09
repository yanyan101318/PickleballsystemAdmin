import React from 'react';

export default function ManualControlPanel({ onAllToggle, onAutoAll }) {
  return (
    <div className="bg-[#101820] border border-[#1E2A36] rounded-xl p-5">
      <div className="flex flex-wrap items-center gap-3">
        <button 
          onClick={() => onAllToggle(true)}
          className="bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold px-4 py-2 transition-colors text-sm"
        >
          ALL LIGHTS ON
        </button>
        <button 
          onClick={() => onAllToggle(false)}
          className="bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold px-4 py-2 transition-colors text-sm"
        >
          ALL LIGHTS OFF
        </button>
        <div className="flex-1" />
        <button 
          onClick={onAutoAll}
          className="bg-[#22D3EE] hover:bg-cyan-400 text-slate-900 rounded-lg font-bold px-4 py-2 transition-colors text-sm"
        >
          AUTO ALL
        </button>
      </div>
    </div>
  );
}
