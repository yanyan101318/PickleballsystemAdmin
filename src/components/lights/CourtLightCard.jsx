import React, { useState } from 'react';
import { getDeviceId } from '../../services/tisService';

const borderColorMap = {
  1: 'border-cyan-500',
  2: 'border-green-500',
  3: 'border-purple-500',
  4: 'border-amber-500',
};

export default function CourtLightCard({ court, onToggleAuto, onEditCourt, onManualToggle }) {
  const { id, name, deviceName, isOn, autoEnabled } = court;
  const borderColor = borderColorMap[id] || 'border-[#1E2A36]';

  const deviceId = getDeviceId(id);
  const address = deviceId ? `ID …${deviceId.slice(-4)}` : 'UNASSIGNED';

  const [isToggling, setIsToggling] = useState(null); // 'ON' or 'OFF'

  const handleManualToggle = async (state) => {
    setIsToggling(state ? 'ON' : 'OFF');
    await onManualToggle(id, deviceId, state);
    setIsToggling(null);
  };

  return (
    <div className={`bg-[#121A24] rounded-xl border-2 ${borderColor} p-5 flex flex-col relative`}>
      {/* Status badge + edit button */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <button
          id={`edit-card-court-${id}`}
          onClick={() => onEditCourt?.(id)}
          title={`Edit TIS address for ${name}`}
          className="text-[#475569] hover:text-cyan-400 transition-colors rounded flex items-center"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>edit</span>
        </button>
        {autoEnabled ? (
          <span className="px-2 py-1 rounded-full text-[11px] font-extrabold bg-green-500/20 text-green-400 uppercase tracking-wider">
            Auto
          </span>
        ) : (
          <span className="px-2 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-400 uppercase tracking-wider">
            Manual
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span 
          className="material-symbols-outlined text-3xl transition-colors duration-300"
          style={{ color: isOn ? '#F59E0B' : '#475569', textShadow: isOn ? '0 0 10px #F59E0B' : 'none' }}
        >
          lightbulb
        </span>
        <div>
          <h3 className="text-[#F3F6FA] font-bold text-lg">{name}</h3>
          <p className="text-[#8FA1B3] text-[11px] uppercase tracking-wider">{deviceName}</p>
          <p className="text-cyan-500/80 text-[10px] font-mono mt-0.5">{address}</p>
        </div>
      </div>

      <div className="mt-2 mb-6">
        <p className="text-[#8FA1B3] text-[11px] uppercase tracking-wider">
          {court.bookingText || 'Next Booking: None today'}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between">
        {/* Manual ON/OFF Controls */}
        <div className="flex gap-2 shrink-0">
          <button 
            onClick={() => handleManualToggle(true)}
            disabled={isToggling !== null || autoEnabled}
            className={`rounded-lg font-bold px-4 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              isOn ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800 text-[#8FA1B3] hover:bg-slate-700'
            }`}
          >
            {isToggling === 'ON' ? '...' : 'ON'}
          </button>
          <button 
            onClick={() => handleManualToggle(false)}
            disabled={isToggling !== null || autoEnabled}
            className={`rounded-lg font-bold px-4 py-1.5 text-sm transition-colors disabled:opacity-50 ${
              !isOn ? 'bg-slate-700 text-white' : 'bg-[#1E293B] text-[#8FA1B3] hover:bg-slate-700'
            }`}
          >
            {isToggling === 'OFF' ? '...' : 'OFF'}
          </button>
        </div>

        {/* Automation Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-[#8FA1B3] text-xs font-semibold">Automation</span>
          <button 
            onClick={() => onToggleAuto(id, !autoEnabled)}
            className={`w-12 h-6 rounded-full relative transition-colors ${autoEnabled ? 'bg-cyan-500' : 'bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${autoEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
