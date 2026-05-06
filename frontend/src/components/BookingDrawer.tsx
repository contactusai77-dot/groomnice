import { Check, ClipboardCopy, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api/client";

const SERVICES = ["Bath", "Bath & Cut", "Nail Trim", "Full Groom", "Puppy Cut", "De-shed"];

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BookingDrawer({ open, onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    phone: "", client_name: "", pet_name: "",
    service_type: "Full Groom", appointment_time: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [profileUrl, setProfileUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await api.quickBooking(form);
      setProfileUrl(`${window.location.origin}/profile/${res.intake_token}`);
      setStatus("done");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setStatus("idle");
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function reset() {
    setStatus("idle");
    setForm({ phone: "", client_name: "", pet_name: "", service_type: "Full Groom", appointment_time: "" });
    setProfileUrl("");
    setCopied(false);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={status === "done" ? reset : onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">
            {status === "done" ? "Booking Created!" : "New Appointment"}
          </h2>
          <button onClick={reset} className="p-1 text-gray-400"><X size={22} /></button>
        </div>

        {status === "done" ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Copy this link and text it to <strong>{form.client_name || form.phone}</strong> so they can fill out their pet's profile:
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-600 break-all">
              {profileUrl}
            </div>
            <button
              onClick={copyLink}
              className="w-full bg-violet-600 text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 active:bg-violet-700 transition"
            >
              {copied ? <><Check size={17} /> Copied!</> : <><ClipboardCopy size={17} /> Copy Link</>}
            </button>
            <button onClick={reset} className="w-full text-gray-400 text-sm py-1">
              Done
            </button>
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

            <Field label="Service">
              <select value={form.service_type} onChange={set("service_type")} className={inp}>
                {SERVICES.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>

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

const inp = "w-full border border-gray-200 rounded-xl px-3 py-3 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {children}
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
