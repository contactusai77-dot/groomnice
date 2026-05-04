import { Plus, Scissors } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppointmentData, api } from "../api/client";
import AppointmentCard from "../components/AppointmentCard";
import BookingDrawer from "../components/BookingDrawer";

export default function DayView() {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const load = useCallback(async () => {
    try {
      setAppointments(await api.getTodayAppointments());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ready = appointments.filter(a => a.ready).length;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Scissors size={16} className="text-violet-500" />
          <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">
            Groomer Dashboard
          </span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{today}</h1>
        {appointments.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">
            {ready} of {appointments.length} ready to groom
          </p>
        )}
      </div>

      {/* Appointment list */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading…</p>
        ) : appointments.length === 0 ? (
          <Empty />
        ) : (
          appointments.map(a => (
            <AppointmentCard key={a.id} appointment={a} onUpdate={load} />
          ))
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed right-5 bottom-24 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-violet-700 transition z-20"
        aria-label="New appointment"
      >
        <Plus size={26} />
      </button>

      <BookingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={load}
      />
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-3">✂️</div>
      <p className="text-gray-500 font-medium text-lg">No appointments today</p>
      <p className="text-gray-400 text-sm mt-1">Tap + to add one</p>
    </div>
  );
}
