import React from 'react';

export default function SidePanels({ activityLog }) {
  return (
    <div className="w-full xl:w-80 flex flex-col gap-6">
      <div className="bg-[#121A24] rounded-xl border border-[#1E2A36] p-5">
        <h3 className="text-[#F3F6FA] font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-400 text-lg">psychology</span>
          Automation Rules
        </h3>
        <div className="flex flex-col gap-3">
          <div className="bg-[#101820] rounded-lg p-3 border border-[#1E2A36]">
            <p className="text-[11px] text-[#8FA1B3] uppercase tracking-wider mb-1">Lights ON</p>
            <p className="text-sm font-medium text-[#F3F6FA]">5 min before booking</p>
          </div>
          <div className="bg-[#101820] rounded-lg p-3 border border-[#1E2A36]">
            <p className="text-[11px] text-[#8FA1B3] uppercase tracking-wider mb-1">Lights OFF</p>
            <p className="text-sm font-medium text-[#F3F6FA]">2 min after booking</p>
          </div>
        </div>
      </div>

      <div className="bg-[#121A24] rounded-xl border border-[#1E2A36] p-5 flex-1 min-h-[300px] max-h-[400px] xl:max-h-[600px] flex flex-col">
        <h3 className="text-[#F3F6FA] font-bold text-sm mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-cyan-400 text-lg">history</span>
          Activity Log
        </h3>
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {activityLog.length === 0 ? (
            <p className="text-[#8FA1B3] text-xs">No recent activity.</p>
          ) : (
            activityLog.map((log) => (
              <div key={log.id} className="border-l-2 border-slate-700 pl-3">
                <p className="text-[10px] text-[#8FA1B3] mb-1">{log.timestamp}</p>
                <p className="text-xs text-[#F3F6FA]">{log.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
