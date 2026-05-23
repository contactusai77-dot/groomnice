import { CheckCircle, Inbox, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppointmentData, api } from "../api/client";
import { usePending } from "../context/PendingContext";

export default function RequestsPage() {
  const [requests, setRequests] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const { refresh: refreshBadge } = usePending();

  const load = useCallback(async () => {
    try {
      const all = await api.getTodayAppointments();
      setRequests(all.filter(a => a.status === "pending_review"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [load]);

  async function handleConfirm(id: string) {
    await api.updateBookingStatus(id, "confirmed");
    refreshBadge();
    load();
  }

  async function handleDecline(id: string) {
    await api.updateBookingStatus(id, "declined");
    refreshBadge();
    load();
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400">Loading…</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-safe pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Inbox size={16} className="text-violet-500" />
          <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Booking Requests</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
        {requests.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">{requests.length} pending your approval</p>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {requests.length === 0 ? (
          <div className="text-center py-20">
            <Inbox size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">No pending requests</p>
            <p className="text-gray-400 text-sm mt-1">New bookings will appear here</p>
          </div>
        ) : (
          requests.map(a => <RequestCard key={a.id} a={a} onConfirm={handleConfirm} onDecline={handleDecline} />)
        )}
      </div>
    </div>
  );
}

function RequestCard({ a, onConfirm, onDecline }: {
  a: AppointmentData;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);

  const apptDate = a.appointment_date ? new Date(a.appointment_date) : null;
  const dateStr = apptDate?.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) ?? "TBD";
  const timeStr = apptDate?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) ?? "TBD";

  async function act(action: "confirm" | "decline") {
    setBusy(action);
    try {
      if (action === "confirm") await onConfirm(a.id);
      else await onDecline(a.id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 bg-amber-50/20">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">{dateStr}</span>
            <span className="text-base font-bold text-gray-800">{timeStr}</span>
            <span className="text-sm text-gray-400">{a.service_type}</span>
          </div>
          <p className="text-base font-semibold text-gray-800">{a.pet_name || "Unknown Pet"}</p>
          <p className="text-sm text-gray-500">{a.client_name}</p>
        </div>
        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium shrink-0">Online</span>
      </div>

      <div className="flex gap-2 pt-3 border-t border-amber-100">
        <button
          onClick={() => act("confirm")}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-green-50 text-green-600 text-sm font-semibold active:bg-green-100 disabled:opacity-50 transition"
        >
          <CheckCircle size={16} />
          {busy === "confirm" ? "Confirming…" : "Confirm"}
        </button>
        <button
          onClick={() => act("decline")}
          disabled={busy !== null}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-50 text-red-500 text-sm font-semibold active:bg-red-100 disabled:opacity-50 transition"
        >
          <X size={16} />
          {busy === "decline" ? "Declining…" : "Decline"}
        </button>
      </div>
    </div>
  );
}
