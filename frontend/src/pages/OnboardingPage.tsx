import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_PRICES: Record<string, number> = {
  "Full Groom": 75, "Bath & Cut": 60, "Bath": 45,
  "Nail Trim": 20, "Puppy Cut": 65, "De-shed": 70,
};

type Step = 1 | 2 | 3;

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [isMobile, setIsMobile] = useState(false);
  const [workDays, setWorkDays] = useState([0, 1, 2, 3, 4]); // Mon–Fri
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [slotMinutes, setSlotMinutes] = useState(60);
  const [prices, setPrices] = useState({ ...DEFAULT_PRICES });
  const [saving, setSaving] = useState(false);

  function toggleDay(i: number) {
    setWorkDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort());
  }

  async function finish() {
    setSaving(true);
    try {
      await api.updateSettings({
        is_mobile: isMobile,
        working_hours: { days: workDays, start: startTime, end: endTime, slot_minutes: slotMinutes },
        service_prices: prices,
        onboarding_complete: true,
      });
      navigate("/");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 flex items-center justify-center p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">

        {/* Progress dots */}
        <div className="flex gap-2 mb-6 justify-center">
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className={`h-2 rounded-full transition-all ${s === step ? "w-8 bg-violet-600" : s < step ? "w-2 bg-violet-300" : "w-2 bg-gray-200"}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">✂️</div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to Groomnice!</h1>
              <p className="text-gray-400 text-sm mt-2">Let's set up your dashboard. Takes 60 seconds.</p>
            </div>
            <p className="text-sm font-semibold text-gray-700 mb-3">What type of grooming do you do?</p>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <button
                onClick={() => setIsMobile(false)}
                className={`py-5 rounded-2xl border-2 text-center transition ${!isMobile ? "border-violet-500 bg-violet-50" : "border-gray-200"}`}
              >
                <div className="text-2xl mb-1">🏠</div>
                <p className="text-sm font-semibold text-gray-700">Salon / Home</p>
                <p className="text-xs text-gray-400">Fixed location</p>
              </button>
              <button
                onClick={() => setIsMobile(true)}
                className={`py-5 rounded-2xl border-2 text-center transition ${isMobile ? "border-violet-500 bg-violet-50" : "border-gray-200"}`}
              >
                <div className="text-2xl mb-1">🚐</div>
                <p className="text-sm font-semibold text-gray-700">Mobile</p>
                <p className="text-xs text-gray-400">Travel to clients</p>
              </button>
            </div>
            <button onClick={() => setStep(2)}
              className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition">
              Next →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="text-center mb-6">
              <div className="text-3xl mb-2">🗓️</div>
              <h2 className="text-xl font-bold text-gray-900">Working Hours</h2>
            </div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Working days</p>
            <div className="flex gap-1.5 mb-5 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${workDays.includes(i) ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {d}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Start</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className={inp} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">End</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className={inp} />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Slot length</label>
              <select value={slotMinutes} onChange={e => setSlotMinutes(Number(e.target.value))} className={inp}>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>90 minutes</option>
                <option value={120}>2 hours</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm">← Back</button>
              <button onClick={() => setStep(3)} className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition text-sm">Next →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="text-center mb-5">
              <div className="text-3xl mb-2">💰</div>
              <h2 className="text-xl font-bold text-gray-900">Service Prices</h2>
              <p className="text-gray-400 text-sm mt-1">Edit to match your rates</p>
            </div>
            <div className="space-y-2 mb-6">
              {Object.entries(prices).map(([svc, price]) => (
                <div key={svc} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-gray-700 truncate">{svc}</span>
                  <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                    <span className="px-2 text-gray-400 text-sm bg-gray-50 h-full flex items-center py-2">$</span>
                    <input
                      type="number"
                      value={price}
                      onChange={e => setPrices(p => ({ ...p, [svc]: Number(e.target.value) }))}
                      className="w-16 py-2 px-2 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-4 rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm">← Back</button>
              <button onClick={finish} disabled={saving}
                className="flex-1 bg-violet-600 text-white py-4 rounded-2xl font-semibold active:bg-violet-700 transition disabled:opacity-50 text-sm">
                {saving ? "Saving…" : "Let's Go! 🎉"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";
