// src/auth/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children, requiredRole }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="pr-loading">
        <div className="pr-spinner" />
        <span>Verifying access...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && role !== requiredRole) {
    if (role === "admin") return <Navigate to="/admin/dashboard" replace />;
    if (role === "customer") return <Navigate to="/user/home" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
