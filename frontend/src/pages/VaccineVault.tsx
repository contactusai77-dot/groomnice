import { CheckCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { VaultSubmission, api } from "../api/client";

export default function VaccineVault() {
  const [submissions, setSubmissions] = useState<VaultSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    api.getVaccineVault().then(setSubmissions).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 safe-top pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Vaccine Vault</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          {submissions.length} pending review
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading…</p>
        ) : submissions.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">✅</div>
            <p className="text-gray-500 font-medium">All caught up!</p>
            <p className="text-gray-400 text-sm mt-1">No vaccine certs pending review</p>
          </div>
        ) : (
          submissions.map(s => <VaccineCard key={s.id} submission={s} onConfirm={load} />)
        )}
      </div>
    </div>
  );
}

function VaccineCard({ submission: s, onConfirm }: { submission: VaultSubmission; onConfirm: () => void }) {
  const [expiry, setExpiry] = useState(s.ai_expiry || "");
  const [saving, setSaving] = useState(false);

  async function confirm() {
    if (!expiry) return;
    setSaving(true);
    try {
      await api.confirmVaccine(s.id, expiry);
      onConfirm();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex">
        {/* Left — photo */}
        <div className="w-28 shrink-0 bg-gray-100 relative">
          {s.image_url ? (
            <img
              src={s.image_url}
              alt="Vaccine certificate"
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-3xl">
              📋
            </div>
          )}
        </div>

        {/* Right — details */}
        <div className="flex-1 p-4 min-w-0">
          <p className="font-semibold text-gray-800 truncate">{s.pet_name}</p>
          <p className="text-sm text-gray-400 mb-3">{s.client_name}</p>

          <label className="block text-xs font-medium text-gray-500 mb-1">
            Expiry Date {s.ai_expiry ? "(AI pre-filled)" : "(enter manually)"}
          </label>
          <input
            type="date"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 mb-3"
          />

          <button
            onClick={confirm}
            disabled={!expiry || saving}
            className="w-full flex items-center justify-center gap-1.5 bg-green-50 text-green-700 py-2.5 rounded-xl text-sm font-semibold active:bg-green-100 disabled:opacity-50 transition"
          >
            <CheckCircle size={15} />
            {saving ? "Saving…" : "Confirm & Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
