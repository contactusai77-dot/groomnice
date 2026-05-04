import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import BottomNav from "./components/BottomNav";
import BookingForm from "./pages/BookingForm";
import Clients from "./pages/Clients";
import DayView from "./pages/DayView";
import PaymentCancel from "./pages/PaymentCancel";
import PaymentSuccess from "./pages/PaymentSuccess";
import PetProfile from "./pages/PetProfile";
import SettingsPage from "./pages/SettingsPage";
import VaccineUpload from "./pages/VaccineUpload";
import VaccineVault from "./pages/VaccineVault";

const GROOMER_PATHS = ["/", "/clients", "/settings", "/vault"];

function Layout() {
  const { pathname } = useLocation();
  const isGroomer = GROOMER_PATHS.includes(pathname);

  return (
    <div className={isGroomer ? "bg-gray-50" : "min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50"}>
      <Routes>
        {/* ── Groomer dashboard ── */}
        <Route path="/" element={<DayView />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/vault" element={<VaccineVault />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* ── Customer-facing ── */}
        <Route path="/book" element={<BookingForm />} />
        <Route path="/profile/:token" element={<PetProfile />} />
        <Route path="/vaccine/:token" element={<VaccineUpload />} />
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
      <Layout />
    </BrowserRouter>
  );
}
