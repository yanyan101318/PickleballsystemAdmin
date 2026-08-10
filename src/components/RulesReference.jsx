// src/components/RulesReference.jsx
import { useState } from "react";
import { PICKLEBALL_RULES } from "../utils/pickleballRules";

export default function RulesReference({ onClose }) {
  const [activeTab, setActiveTab] = useState("scoring");

  return (
    <div className="rules-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rules-box">
        <div className="rules-header">
          <h2>📚 Pickleball Tournament Rules</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>

        <div className="rules-tabs">
          <button
            className={`rules-tab ${activeTab === "scoring" ? "active" : ""}`}
            onClick={() => setActiveTab("scoring")}
          >
            🎯 Scoring
          </button>
          <button
            className={`rules-tab ${activeTab === "serving" ? "active" : ""}`}
            onClick={() => setActiveTab("serving")}
          >
            🎾 Serving
          </button>
          <button
            className={`rules-tab ${activeTab === "formats" ? "active" : ""}`}
            onClick={() => setActiveTab("formats")}
          >
            🏆 Formats
          </button>
        </div>

        <div className="rules-content">
          {activeTab === "scoring" && (
            <div className="rules-section">
              <h3>{PICKLEBALL_RULES.scoring.title}</h3>
              <ul className="rules-list">
                {PICKLEBALL_RULES.scoring.rules.map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "serving" && (
            <>
              <div className="rules-section">
                <h3>{PICKLEBALL_RULES.serving.title}</h3>
                <ul className="rules-list">
                  {PICKLEBALL_RULES.serving.rules.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
              <div className="rules-section">
                <h3>{PICKLEBALL_RULES.singleServing.title}</h3>
                <ul className="rules-list">
                  {PICKLEBALL_RULES.singleServing.rules.map((rule, i) => (
                    <li key={i}>{rule}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {activeTab === "formats" && (
            <>
              <div className="rules-section">
                <h3>{PICKLEBALL_RULES.tournamentFormats.title}</h3>
                <div className="format-grid">
                  {Object.entries(PICKLEBALL_RULES.tournamentFormats.formats).map(([key, fmt]) => (
                    <div key={key} className="format-card">
                      <div className="format-icon">{fmt.icon}</div>
                      <div className="format-name">{fmt.name}</div>
                      <div className="format-desc">{fmt.description}</div>
                      <div className="format-teams">{fmt.teams}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rules-section">
                <h3>{PICKLEBALL_RULES.matchFormats.title}</h3>
                <div className="format-list">
                  {Object.entries(PICKLEBALL_RULES.matchFormats.formats).map(([key, fmt]) => (
                    <div key={key} className="format-item">
                      <div className="format-item-name">{fmt.name}</div>
                      <div className="format-item-desc">{fmt.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rules-section">
                <h3>{PICKLEBALL_RULES.seeding.title}</h3>
                <div className="seeding-grid">
                  {Object.entries(PICKLEBALL_RULES.seeding.options).map(([key, opt]) => (
                    <div key={key} className="seeding-card">
                      <div className="seeding-icon">{opt.icon}</div>
                      <div className="seeding-name">{opt.name}</div>
                      <div className="seeding-desc">{opt.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
