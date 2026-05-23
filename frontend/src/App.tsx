import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import BottomNav from "./components/BottomNav";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { PendingProvider } from "./context/PendingContext";
import RequestsPage from "./pages/RequestsPage";
import BookingForm from "./pages/BookingForm";
import Clients from "./pages/Clients";
import DayView from "./pages/DayView";
import FeedbackPage from "./pages/FeedbackPage";
import LoginPage from "./pages/LoginPage";
import OnboardingPage from "./pages/OnboardingPage";
import PaymentCancel from "./pages/PaymentCancel";
import PaymentSuccess from "./pages/PaymentSuccess";
import PetProfile from "./pages/PetProfile";
import PrivacyPage from "./pages/PrivacyPage";
import RegisterPage from "./pages/RegisterPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import TermsPage from "./pages/TermsPage";
import VaccineUpload from "./pages/VaccineUpload";
import VaccineVault from "./pages/VaccineVault";

const GROOMER_PATHS = ["/", "/requests", "/clients", "/reports", "/settings", "/vault", "/onboarding"];

function Layout() {
  const { pathname } = useLocation();
  const isGroomer = GROOMER_PATHS.includes(pathname);

  return (
    <div className={isGroomer ? "bg-gray-50" : "min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50"}>
      <Routes>
        {/* ── Admin (key-gated, no groomer JWT needed) ── */}
        <Route path="/admin" element={<AdminPage />} />

        {/* ── Auth ── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ── Groomer dashboard (protected) ── */}
        <Route path="/" element={<ProtectedRoute><DayView /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
        <Route path="/vault" element={<ProtectedRoute><VaccineVault /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

        {/* ── Groomer onboarding (protected) ── */}
        <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />

        {/* ── Legal (public) ── */}
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />

        {/* ── Customer-facing (public) ── */}
        <Route path="/book/:slug" element={<BookingForm />} />
        <Route path="/book" element={<Navigate to="/login" replace />} />
        <Route path="/profile/:token" element={<PetProfile />} />
        <Route path="/vaccine/:token" element={<VaccineUpload />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/booking/success" element={<PaymentSuccess />} />
        <Route path="/booking/cancel" element={<PaymentCancel />} />
      </Routes>

      {isGroomer && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <PendingProvider>
          <Layout />
        </PendingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
