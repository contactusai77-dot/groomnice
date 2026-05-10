import { useEffect, useState } from "react";
import { SettingsData, api } from "../api/client";

const SERVICES = ["Full Groom", "Bath & Cut", "Bath", "Nail Trim", "Puppy Cut", "De-shed"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [flash, setFlash] = useState<"saving" | "saved" | null>(null);

  useEffect(() => { api.getSettings().then(setSettings); }, []);

  async function save(updated: SettingsData) {
    setSettings(updated);
    setFlash("saving");
    await api.updateSettings(updated);
    setFlash("saved");
    setTimeout(() => setFlash(null), 1800);
  }

  function toggle(key: keyof SettingsData) {
    if (!settings) return;
    save({ ...settings, [key]: !settings[key] });
  }

  function updatePrice(service: string, value: string) {
    if (!settings) return;
    const num = parseFloat(value);
    setSettings(s => s ? { ...s, service_prices: { ...s.service_prices, [service]: isNaN(num) ? 0 : num } } : s);
  }

  function savePrice() {
    if (settings) save(settings);
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-28">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Pricing & automation</p>
      </div>

      <div className="px-4 py-4 space-y-3">
        <Section title="Service Pricing" />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          {SERVICES.map(svc => (
            <div key={svc} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-700 flex-1">{svc}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={settings.service_prices[svc] ?? ""}
                  onChange={e => updatePrice(svc, e.target.value)}
                  onBlur={savePrice}
                  className="w-20 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
            </div>
          ))}
        </div>

        <Section title="Deposit" />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Required deposit ($)
          </label>
          <input
            type="number"
            value={settings.deposit_amount}
            onChange={e => setSettings(s => s ? { ...s, deposit_amount: Number(e.target.value) } : s)}
            onBlur={() => settings && save(settings)}
            min={0} max={500} step={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <Section title="Automation" />

        <Toggle
          label="Require deposit for new clients"
          description="$25 deposit required before slot is confirmed"
          checked={settings.require_deposit}
          onToggle={() => toggle("require_deposit")}
        />
        <Toggle
          label="Send 24-hr reminder text"
          description="Automatically remind clients the day before"
          checked={settings.send_24h_reminder}
          onToggle={() => toggle("send_24h_reminder")}
        />
        <Toggle
          label="Send 'Fill My Gap' text on cancel"
          description="Alert you when an appointment slot opens up"
          checked={settings.send_gap_fill_text}
          onToggle={() => toggle("send_gap_fill_text")}
        />

        {flash && (
          <p className={`text-center text-sm ${flash === "saved" ? "text-green-500" : "text-gray-400"}`}>
            {flash === "saved" ? "Saved ✓" : "Saving…"}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1 pt-2">
      {title}
    </h2>
  );
}

function Toggle({ label, description, checked, onToggle }: {
  label: string; description: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={checked}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${checked ? "bg-violet-500" : "bg-gray-200"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
