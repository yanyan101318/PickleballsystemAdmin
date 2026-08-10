// src/auth/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "pg_user";

// Ensure display_name from PostgreSQL is always available as .name
// so existing components that read profile?.name keep working.
function normalizeUser(userData) {
  if (!userData) return userData;
  return {
    ...userData,
    name: userData.name || userData.display_name || "",
    uid: userData.uid || userData.id,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // PostgreSQL user object
  const [profile, setProfile] = useState(null);   // same object aliased as profile
  const [role, setRole]       = useState(null);   // "admin" | "customer"
  const [loading, setLoading] = useState(true);

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = normalizeUser(JSON.parse(stored));
        setUser(parsed);
        setProfile(parsed);
        setRole(parsed.role);
      }
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  function loginUser(userData) {
    const normalized = normalizeUser(userData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    setUser(normalized);
    setProfile(normalized);
    setRole(normalized.role);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setProfile(null);
    setRole(null);
  }

  function updateProfile(updatedData) {
    const updatedUser = { ...user, ...updatedData };
    const normalized = normalizeUser(updatedUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    setUser(normalized);
    setProfile(normalized);
  }

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, loginUser, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}