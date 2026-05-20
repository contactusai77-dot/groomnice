import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Props {
  bookingId: string;
  clientName: string;
  onClose: () => void;
  onSaved: () => void;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function RescheduleModal({ bookingId, clientName, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedTime("");
    setSlots([]);
    api.getAvailabilitySlots(selectedDate)
      .then(r => setSlots(r.slots))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

  async function handleSave() {
    if (!selectedDate || !selectedTime) return;
    setSaving(true);
    setError("");
    try {
      await api.rescheduleBooking(bookingId, selectedDate, selectedTime);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setSaving(false);
    }
  }

  // Quick-select next 14 days
  const datePills = Array.from({ length: 14 }, (_, i) => addDays(i));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">Reschedule — {clientName}</h3>
          <button onClick={onClose} className="p-1 text-gray-400 active:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Date selector */}
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Date</p>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
          {datePills.map(d => {
            const label = new Date(d + "T12:00:00");
            return (
              <button
                key={d}
                onClick={() => setSelectedDate(d)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-2.5 rounded-2xl border transition min-w-[58px] ${
                  selectedDate === d
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-gray-50 text-gray-700 border-gray-200"
                }`}
              >
                <span className="text-xs font-medium">
                  {label.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="text-base font-bold mt-0.5">{label.getDate()}</span>
              </button>
            );
          })}
        </div>

        {/* Time slots */}
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Time</p>
        {slotsLoading ? (
          <p className="text-sm text-gray-400 py-3 text-center">Loading slots…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-amber-600 py-2 text-center">No open slots on this day</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {slots.map(t => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                  selectedTime === t
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-gray-50 text-gray-700 border-gray-200"
                }`}
              >
                {fmt12(t)}
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}

        <button
          onClick={handleSave}
          disabled={!selectedDate || !selectedTime || saving}
          className="w-full bg-violet-600 text-white py-3.5 rounded-2xl font-semibold text-sm disabled:opacity-40 active:bg-violet-700 transition"
        >
          {saving ? "Saving…" : "Confirm Reschedule"}
        </button>
      </div>
    </div>
  );
}
