// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute   from "./auth/ProtectedRoute";

// Auth
import LoginPage    from "./auth/LoginPage";
import RegisterPage from "./auth/RegisterPage";

// Admin
import AdminLayout          from "./admin/AdminLayout";
import AdminDashboard       from "./admin/AdminDashboard";
import CourtManager         from "./admin/CourtManager";
import BookingManager       from "./admin/BookingManager";
import Analytics            from "./admin/Analytics";
import CrmPage              from "./admin/CrmPage";
import MembershipRequests   from "./admin/MembershipRequests";
import AnnouncementManager  from "./admin/AnnouncementManager";
import AdminTournament      from "./admin/AdminTournament";
import AdminSchedule        from "./admin/AdminSchedule";
import Book                 from "./components/Book";
import InventoryPage        from "./admin/InventoryPage";
import PaddleStackingPage   from "./admin/PaddleStackingPage";
import AdminProfile         from "./admin/AdminProfile";
import AdminChat            from "./admin/AdminChat";
import AdminTournamentV2    from "./admin/AdminTournamentV2";

// Tournament public pages (scorer / viewer)
import ScorerPage from "./pages/ScorerPage";
import ViewerPage from "./pages/ViewerPage";
import CustomerAccountPage from "./pages/CustomerAccountPage";
import PaddleViewerPage from "./pages/PaddleViewerPage";
import PaddleScorerPage from "./pages/PaddleScorerPage";
import TournamentScoringPage from "./pages/TournamentScoringPage";

import "./App.css";
import "./admin/admin.css";
import "./auth/auth.css";
import { Toaster } from "react-hot-toast";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: "#151e2d", color: "#e2e8f0", border: "1px solid #334155" },
          }}
        />
        <Routes>

          {/* ── PUBLIC ── */}
          <Route path="/login"    element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>

          {/* ── PUBLIC TOURNAMENT VIEWS ── */}
          <Route path="/bracket/:tournamentId"           element={<ViewerPage/>}/>
          <Route path="/score/:tournamentId/:matchId"    element={<ScorerPage/>}/>
          <Route path="/account"                         element={<CustomerAccountPage/>}/>
          <Route path="/paddle-viewer"                   element={<PaddleViewerPage/>}/>
          <Route path="/paddle-score/:courtId?"          element={<PaddleScorerPage/>}/>
          <Route path="/scoring/:matchId"                element={<TournamentScoringPage/>}/>

          {/* ── ADMIN PANEL ── */}
          <Route path="/admin" element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout/>
            </ProtectedRoute>
          }>
            <Route index                element={<Navigate to="/admin/dashboard" replace/>}/>
            <Route path="dashboard"     element={<AdminDashboard/>}/>
            <Route path="schedule"      element={<AdminSchedule/>}/>
            <Route path="new-booking"   element={<Book/>}/>
            <Route path="courts"        element={<CourtManager/>}/>
            <Route path="bookings"      element={<BookingManager/>}/>
            <Route path="crm"           element={<CrmPage/>}/>
            <Route path="memberships"   element={<MembershipRequests/>}/>
            <Route path="tournament"    element={<AdminTournament/>}/>
            <Route path="tournament-v2" element={<AdminTournamentV2/>}/>
            <Route path="paddle-stack"  element={<PaddleStackingPage/>}/>
            <Route path="analytics"     element={<Analytics/>}/>
            <Route path="equipment"     element={<InventoryPage/>}/>
            <Route path="inventory"     element={<Navigate to="/admin/equipment" replace />}/>
            <Route path="announcements" element={<AnnouncementManager/>}/>
            <Route path="profile"       element={<AdminProfile/>}/>
            <Route path="support"       element={<AdminChat/>}/>
          </Route>

          {/* ── CUSTOMER PANEL ── */}
          <Route path="/user/*" element={
            <ProtectedRoute requiredRole="customer">
              <CustomerAccountPage />
            </ProtectedRoute>
          }/>

          {/* ── FALLBACK ── */}
          <Route path="/" element={<Navigate to="/login" replace/>}/>
          <Route path="*" element={<Navigate to="/login" replace/>}/>

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}