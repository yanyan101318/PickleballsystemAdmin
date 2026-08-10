import { useState, useEffect } from "react";
import toast from "react-hot-toast";

export default function MembershipRequests() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "PICKLE BROS COURT | Membership Requests";
  }, []);

  return (
    <div className="ad-page">
      <div className="ad-page-header">
        <div>
          <h1 className="ad-page-title">Membership Requests</h1>
          <p className="ad-page-sub">Manage membership applications from customers.</p>
        </div>
      </div>
      <div className="ad-card" style={{ padding: "3rem", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🏅</div>
        <h3 className="text-white font-bold text-lg mb-2">Memberships</h3>
        <p className="text-slate-400 text-sm">
          Membership requests will appear here once the <code>memberships</code> table is set up in PostgreSQL.
        </p>
      </div>
    </div>
  );
}
