export default function Background() {
  return (
    <div className="app-background">
      {/* Geometric pattern overlay */}
      <div className="bg-geometric-pattern" />
      
      {/* Floating gradient orbs */}
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />
      
      {/* Court grid lines */}
      <svg className="bg-court-lines" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <rect x="200" y="300" width="400" height="250" fill="none" stroke="#c8e63a08" strokeWidth="1" rx="4"/>
        <line x1="400" y1="300" x2="400" y2="550" stroke="#c8e63a08" strokeWidth="1"/>
        <line x1="200" y1="425" x2="600" y2="425" stroke="#c8e63a08" strokeWidth="1"/>
        <circle cx="150" cy="200" r="80" fill="none" stroke="#c8e63a05" strokeWidth="1"/>
        <circle cx="850" cy="150" r="120" fill="none" stroke="#c8e63a05" strokeWidth="1"/>
        <circle cx="800" cy="800" r="100" fill="none" stroke="#c8e63a05" strokeWidth="1"/>
      </svg>
    </div>
  );
}