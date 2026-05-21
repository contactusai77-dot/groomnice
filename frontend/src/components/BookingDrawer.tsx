import { Check, ClipboardCopy, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PriceEstimate, api } from "../api/client";

const SERVICES = ["Bath", "Bath & Cut", "Nail Trim", "Full Groom", "Puppy Cut", "De-shed"];
const COAT_CONDITIONS = ["normal", "matted", "thick double-coat", "very long", "short/easy"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialTime?: string;
}

export default function BookingDrawer({ open, onClose, onSuccess, initialTime }: Props) {
  const [form, setForm] = useState({
    phone: "", client_name: "", pet_name: "", breed: "",
    service_type: "Full Groom", appointment_time: initialTime ?? "",
    temperament: "friendly", coat_condition: "normal",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [profileUrl, setProfileUrl] = useState("");
  const [vaccineUrl, setVaccineUrl] = useState("");
  const [copied, setCopied] = useState<"profile" | "vaccine" | null>(null);
  const [error, setError] = useState("");
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  useEffect(() => {
    if (open) setForm(f => ({ ...f, appointment_time: initialTime ?? "" }));
  }, [open, initialTime]);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleAiPrice() {
    if (!form.breed && !form.service_type) return;
    setEstimating(true);
    try {
      const res = await api.priceEstimate({
        breed: form.breed,
        service_type: form.service_type,
        temperament: form.temperament,
        coat_condition: form.coat_condition,
      });
      setEstimate(res);
    } finally {
      setEstimating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await api.quickBooking({
        phone: form.phone,
        client_name: form.client_name,
        pet_name: form.pet_name,
        service_type: form.service_type,
        appointment_time: form.appointment_time,
      });
      const origin = window.location.origin;
      setProfileUrl(`${origin}/profile/${res.intake_token}`);
      setVaccineUrl(`${origin}/vaccine/${res.intake_token}`);
      setStatus("done");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStatus("idle");
    }
  }

  function copyLink(which: "profile" | "vaccine") {
    navigator.clipboard.writeText(which === "profile" ? profileUrl : vaccineUrl);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  function reset() {
    setStatus("idle");
    setEstimate(null);
    setForm({
      phone: "", client_name: "", pet_name: "", breed: "",
      service_type: "Full Groom", appointment_time: initialTime ?? "",
      temperament: "friendly", coat_condition: "normal",
    });
    setProfileUrl(""); setVaccineUrl(""); setCopied(null);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={status === "done" ? reset : onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {status === "done" ? "Booking Created!" : "New Appointment"}
          </h2>
          <button onClick={reset} className="p-1 text-gray-400"><X size={22} /></button>
        </div>

        {status === "done" ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              Text these links to <strong>{form.client_name || form.phone}</strong>:
            </p>
            <LinkBlock label="Pet profile (intake form)" url={profileUrl} copied={copied === "profile"}
              onCopy={() => copyLink("profile")} color="violet" />
            <LinkBlock label="Vaccine upload" url={vaccineUrl} copied={copied === "vaccine"}
              onCopy={() => copyLink("vaccine")} color="emerald" />
            <button onClick={reset} className="w-full text-gray-400 text-sm py-1">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone *">
                <input type="tel" value={form.phone} onChange={set("phone")}
                  placeholder="555-000-0000" required inputMode="tel" className={inp} />
              </Field>
              <Field label="Client Name">
                <input type="text" value={form.client_name} onChange={set("client_name")}
                  placeholder="Jane Smith" className={inp} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Pet Name">
                <input type="text" value={form.pet_name} onChange={set("pet_name")}
                  placeholder="Biscuit" className={inp} />
              </Field>
              <Field label="Time">
                <input type="time" value={form.appointment_time} onChange={set("appointment_time")}
                  className={inp} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Breed">
                <input type="text" value={form.breed} onChange={set("breed")}
                  placeholder="Golden Retriever" className={inp} />
              </Field>
              <Field label="Service">
                <select value={form.service_type} onChange={set("service_type")} className={inp}>
                  {SERVICES.map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Temperament">
                <select value={form.temperament} onChange={set("temperament")} className={inp}>
                  <option value="friendly">🟢 Friendly</option>
                  <option value="anxious">🟡 Anxious</option>
                  <option value="aggressive">🔴 Aggressive</option>
                </select>
              </Field>
              <Field label="Coat">
                <select value={form.coat_condition} onChange={set("coat_condition")} className={inp}>
                  {COAT_CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* AI Price estimate */}
            <button
              type="button"
              onClick={handleAiPrice}
              disabled={estimating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-50 text-violet-600 text-sm font-medium active:bg-violet-100 transition disabled:opacity-50"
            >
              <Sparkles size={15} />
              {estimating ? "Estimating…" : "AI Price Estimate"}
            </button>

            {estimate && !estimate.error && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-700 text-lg">
                    {estimate.price != null ? `$${estimate.price}` : "—"}
                  </span>
                  <span className="text-xs text-green-600">{estimate.duration_minutes} min</span>
                </div>
                <p className="text-xs text-green-600 mt-0.5">{estimate.notes}</p>
                <p className="text-xs text-amber-600 mt-2 pt-2 border-t border-green-100">
                  ⚠️ AI estimate — verify before quoting the client.
                </p>
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={status === "loading"}
              className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 active:bg-violet-700 disabled:opacity-50 transition"
            >
              {status === "loading" ? "Creating…" : "Create Booking →"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

function LinkBlock({ label, url, copied, onCopy, color }: {
  label: string; url: string; copied: boolean; onCopy: () => void; color: "violet" | "emerald";
}) {
  const btn = color === "violet"
    ? "bg-violet-600 active:bg-violet-700"
    : "bg-emerald-600 active:bg-emerald-700";
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-600 break-all mb-1.5">{url}</div>
      <button onClick={onCopy}
        className={`w-full ${btn} text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition text-sm`}>
        {copied ? <><Check size={15} /> Copied!</> : <><ClipboardCopy size={15} /> Copy {label.split(" ")[0]} Link</>}
      </button>
    </div>
  );
}

const inp = "w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
