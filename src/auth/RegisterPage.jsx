// src/auth/RegisterPage.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  isRegisterAccessGranted,
  clearRegisterAccess,
} from "./registerAccess";
import RanawLogo from "../components/RanawLogo";

const API_URL = import.meta.env.VITE_API_URL || 'https://pickleballsystemadmin.onrender.com';

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "PICKLE BROS COURT | Register";
    if (!isRegisterAccessGranted()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  function set(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      clearRegisterAccess();
      setSuccess(true);
    } catch (err) {
      setError("Network error. Please check your connection.");
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-left">
          <div className="auth-brand">
            <RanawLogo variant="auth" />
            <p className="auth-brand-tagline">Court Reservation Management</p>
          </div>
          <div className="auth-left-features">
            <div className="alf-item">
              <span className="alf-icon">🏆</span>
              <span>Tournament Management</span>
            </div>
            <div className="alf-item">
              <span className="alf-icon">📅</span>
              <span>Court Booking</span>
            </div>
            <div className="alf-item">
              <span className="alf-icon">💳</span>
              <span>Payment Processing</span>
            </div>
            <div className="alf-item">
              <span className="alf-icon">📊</span>
              <span>Analytics Dashboard</span>
            </div>
          </div>
        </div>

        <div className="auth-right">
          <div className="auth-card">
            <div className="auth-card-logo">
              <RanawLogo variant="authCard" />
            </div>
            <div className="auth-card-header">
              <h2 className="auth-card-title">Account Created!</h2>
              <p className="auth-card-sub">
                Your administrator account has been saved to the database. You can now sign in.
              </p>
            </div>
            <p className="auth-success-note">
              Your credentials have been securely stored in PostgreSQL. Sign in to get started.
            </p>
            <Link to="/login" className="af-submit auth-success-link">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <RanawLogo variant="auth" />
          <p className="auth-brand-tagline">Court Reservation Management</p>
        </div>
        <div className="auth-left-features">
          <div className="alf-item">
            <span className="alf-icon">🏆</span>
            <span>Tournament Management</span>
          </div>
          <div className="alf-item">
            <span className="alf-icon">📅</span>
            <span>Court Booking</span>
          </div>
          <div className="alf-item">
            <span className="alf-icon">💳</span>
            <span>Payment Processing</span>
          </div>
          <div className="alf-item">
            <span className="alf-icon">📊</span>
            <span>Analytics Dashboard</span>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <div className="auth-card-logo">
            <RanawLogo variant="authCard" />
          </div>
          <div className="auth-card-header">
            <h2 className="auth-card-title">Create your PICKLE BROS COURT account</h2>
            <p className="auth-card-sub">
              New accounts are administrators. Your data will be saved to PostgreSQL.
            </p>
          </div>

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="af-row">
              <div className="af-group">
                <label className="af-label">Full name</label>
                <input
                  className="af-input"
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Juan dela Cruz"
                  required
                />
              </div>
              <div className="af-group">
                <label className="af-label">Phone number</label>
                <input
                  className="af-input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="09XX XXX XXXX"
                  required
                />
              </div>
            </div>

            <div className="af-group">
              <label className="af-label">Email address</label>
              <input
                className="af-input"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="af-row">
              <div className="af-group">
                <label className="af-label">Password</label>
                <div className="af-input-wrap">
                  <input
                    className="af-input"
                    type={showPass ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    placeholder="Min. 6 characters"
                    required
                  />
                  <button
                    type="button"
                    className="af-eye"
                    onClick={() => setShowPass((p) => !p)}
                  >
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div className="af-group">
                <label className="af-label">Confirm password</label>
                <input
                  className="af-input"
                  type="password"
                  value={form.confirm}
                  onChange={(e) => set("confirm", e.target.value)}
                  placeholder="Repeat password"
                  required
                />
              </div>
            </div>

            <div className="af-group">
              <label className="af-label">Account type</label>
              <div className="af-role-single">
                <span className="af-role-single-icon">🔧</span>
                <span>Administrator</span>
              </div>
            </div>

            {error && (
              <div className="af-error">
                <span>⚠</span>
                {error}
              </div>
            )}

            <button className="af-submit" type="submit" disabled={loading}>
              {loading ? <span className="af-spinner" /> : "Create Account"}
            </button>
          </form>

          <div className="auth-card-footer">
            Already have an account?{" "}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
