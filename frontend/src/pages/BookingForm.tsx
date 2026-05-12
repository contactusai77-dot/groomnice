import { CalendarDays, Check, ChevronRight, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { BookingSlot, api } from "../api/client";

const SERVICES = ["Bath", "Bath & Cut", "Nail Trim", "Full Groom", "Puppy Cut", "De-shed"];

type Step = "pick" | "info" | "done";

export default function BookingForm() {
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [step, setStep] = useState<Step>("pick");

  const [service, setService] = useState("Full Groom");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [petName, setPetName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getBookingSlots()
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

  const selectedDaySlots = slots.find(s => s.date === selectedDate)?.slots ?? [];

  function handlePickNext() {
    if (!selectedDate || !selectedTime) return;
    setStep("info");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.onlineBook({
        phone,
        name,
        pet_name: petName,
        service_type: service,
        slot_date: selectedDate,
        slot_time: selectedTime,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function formatTime(t: string) {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
  }

  if (step === "done") {
    return (
      <Screen>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Request Sent!</h2>
          <p className="text-gray-500 text-sm mb-4">
            We'll confirm your <strong>{service}</strong> on{" "}
            <strong>{formatDate(selectedDate)}</strong> at{" "}
            <strong>{formatTime(selectedTime)}</strong> within the hour.
          </p>
          <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 text-sm text-violet-800 text-left">
            Check your phone — we'll text you a confirmation and a link to upload your pet's vaccine record.
          </div>
        </div>
      </Screen>
    );
  }

  if (step === "info") {
    return (
      <Screen>
        <button onClick={() => setStep("pick")} className="text-sm text-violet-600 mb-4 flex items-center gap-1">
          ← Change time
        </button>

        <div className="bg-violet-50 rounded-2xl px-4 py-3 mb-5 text-sm text-violet-800 flex items-center gap-2">
          <CalendarDays size={15} />
          <span>
            <strong>{service}</strong> · {formatDate(selectedDate)} · {formatTime(selectedTime)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={lbl}>Your Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Jane Smith" required autoComplete="name" className={inp} />
          </div>
          <div>
            <label className={lbl}>Mobile Number</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="(555) 000-0000" required autoComplete="tel" inputMode="tel" className={inp} />
          </div>
          <div>
            <label className={lbl}>Pet's Name</label>
            <input type="text" value={petName} onChange={e => setPetName(e.target.value)}
              placeholder="Biscuit" className={inp} />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-base active:bg-violet-700 transition disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
            {submitting ? "Sending…" : <><span>Request Appointment</span><ChevronRight size={18} /></>}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          We'll text you to confirm. No app needed.
        </p>
      </Screen>
    );
  }

  // Step: pick service + date + time
  return (
    <Screen>
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">✂️</div>
        <h1 className="text-2xl font-bold text-gray-800">Book an Appointment</h1>
        <p className="text-gray-400 text-sm mt-1">Pick a service and time</p>
      </div>

      {/* Service picker */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Service</p>
      <div className="flex flex-wrap gap-2 mb-5">
        {SERVICES.map(s => (
          <button key={s} onClick={() => setService(s)}
            className={`px-3 py-2 rounded-xl text-sm font-medium border transition ${
              service === s
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-600 border-gray-200 active:bg-gray-50"
            }`}>
            {s}
          </button>
        ))}
      </div>

      {/* Date picker */}
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
        <CalendarDays size={12} /> Date
      </p>

      {loadingSlots ? (
        <p className="text-gray-400 text-sm py-4 text-center">Loading availability…</p>
      ) : slots.length === 0 ? (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-sm text-amber-700 mb-5">
          No available slots right now — check back soon or call us directly.
        </div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
            {slots.map(day => (
              <button key={day.date} onClick={() => { setSelectedDate(day.date); setSelectedTime(""); }}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-2xl border transition min-w-[68px] ${
                  selectedDate === day.date
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                }`}>
                <span className="text-xs font-medium">{day.day_name.slice(0, 3)}</span>
                <span className="text-base font-bold mt-0.5">
                  {new Date(day.date + "T12:00:00").getDate()}
                </span>
              </button>
            ))}
          </div>

          {/* Time slots */}
          {selectedDate && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1">
                <Clock size={12} /> Time
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {selectedDaySlots.map(t => (
                  <button key={t} onClick={() => setSelectedTime(t)}
                    className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                      selectedTime === t
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-white text-gray-700 border-gray-200 active:bg-gray-50"
                    }`}>
                    {formatTime(t)}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <button onClick={handlePickNext}
        disabled={!selectedDate || !selectedTime}
        className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold text-base active:bg-violet-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
        <span>Next</span><ChevronRight size={18} />
      </button>
    </Screen>
  );
}

const lbl = "block text-sm font-medium text-gray-700 mb-1.5";
const inp = "w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-center min-h-screen p-5 pt-10">
      <div className="bg-white rounded-3xl shadow-xl p-6 w-full max-w-sm">{children}</div>
    </div>
  );
}
