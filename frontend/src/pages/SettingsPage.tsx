import { CalendarOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { BlockDateResult, SettingsData, WaitlistEntryData, WorkingHours, api } from "../api/client";

const SERVICES = ["Full Groom", "Bath & Cut", "Bath", "Nail Trim", "Puppy Cut", "De-shed"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [flash, setFlash] = useState<"saving" | "saved" | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntryData[]>([]);
  const [wlForm, setWlForm] = useState({ phone: "", name: "" });
  const [wlAdding, setWlAdding] = useState(false);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [blockInput, setBlockInput] = useState("");
  const [blockConflicts, setBlockConflicts] = useState<BlockDateResult["conflicts"]>([]);
  const [autoDeclined, setAutoDeclined] = useState<BlockDateResult["auto_declined"]>([]);
  const [blockPending, setBlockPending] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings);
    api.getWaitlist().then(setWaitlist);
    api.getBlockedDates().then(r => setBlockedDates(r.blocked_dates));
  }, []);

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

  function toggleWorkDay(dayIdx: number) {
    if (!settings) return;
    const wh: WorkingHours = settings.working_hours;
    const days = wh.days.includes(dayIdx)
      ? wh.days.filter(d => d !== dayIdx)
      : [...wh.days, dayIdx].sort();
    save({ ...settings, working_hours: { ...wh, days } });
  }

  function updateWorkHours(field: "start" | "end", value: string) {
    if (!settings) return;
    setSettings(s => s ? { ...s, working_hours: { ...s.working_hours, [field]: value } } : s);
  }

  function saveWorkHours() {
    if (settings) save(settings);
  }

  function toggleSlotDuration() {
    if (!settings) return;
    const current = settings.working_hours.slot_minutes;
    save({ ...settings, working_hours: { ...settings.working_hours, slot_minutes: current === 60 ? 30 : 60 } });
  }

  async function handleBlockDate(e: React.FormEvent) {
    e.preventDefault();
    if (!blockInput) return;
    setBlockPending(true);
    try {
      const result = await api.blockDate(blockInput);
      setBlockedDates(result.blocked_dates);
      setBlockConflicts(result.conflicts);
      setAutoDeclined(result.auto_declined ?? []);
      setBlockInput("");
    } finally {
      setBlockPending(false);
    }
  }

  async function handleUnblockDate(d: string) {
    const result = await api.unblockDate(d);
    setBlockedDates(result.blocked_dates);
    setBlockConflicts([]);
    setAutoDeclined([]);
  }

  async function addWaitlist(e: React.FormEvent) {
    e.preventDefault();
    if (!wlForm.phone || !wlForm.name) return;
    setWlAdding(true);
    try {
      const entry = await api.addWaitlist(wlForm.phone, wlForm.name);
      setWaitlist(w => [...w, entry]);
      setWlForm({ phone: "", name: "" });
    } finally {
      setWlAdding(false);
    }
  }

  async function removeWaitlist(id: string) {
    await api.removeWaitlist(id);
    setWaitlist(w => w.filter(e => e.id !== id));
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
      <div className="bg-white px-5 safe-top pb-4 border-b border-gray-100">
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

        <Section title="Online Booking — Working Hours" />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-4">
          {/* Working days */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Working days</p>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((label, i) => {
                const active = settings.working_hours.days.includes(i);
                return (
                  <button key={i} onClick={() => toggleWorkDay(i)}
                    className={`w-10 h-10 rounded-xl text-sm font-semibold border transition ${
                      active ? "bg-violet-600 text-white border-violet-600" : "bg-gray-50 text-gray-500 border-gray-200"
                    }`}>
                    {label[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start / End time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Opens</label>
              <input type="time" value={settings.working_hours.start}
                onChange={e => updateWorkHours("start", e.target.value)}
                onBlur={saveWorkHours}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Closes</label>
              <input type="time" value={settings.working_hours.end}
                onChange={e => updateWorkHours("end", e.target.value)}
                onBlur={saveWorkHours}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400" />
            </div>
          </div>

          {/* Slot duration */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Slot duration</p>
              <p className="text-xs text-gray-400 mt-0.5">Time per appointment slot</p>
            </div>
            <button onClick={toggleSlotDuration}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50 active:bg-gray-100">
              {settings.working_hours.slot_minutes} min
            </button>
          </div>
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

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2">
          <label className="block text-sm font-medium text-gray-700">Your notification phone</label>
          <p className="text-xs text-gray-400">Get a text when a client books online. Leave blank to disable.</p>
          <input
            type="tel"
            inputMode="tel"
            value={settings.notification_phone}
            placeholder="+1 555 000 0000"
            onChange={e => setSettings(s => s ? { ...s, notification_phone: e.target.value } : s)}
            onBlur={() => settings && save(settings)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        <Section title="Day Overrides" />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <p className="text-xs text-gray-400">
            Block specific dates — they won't appear in your online booking page.
          </p>

          {blockedDates.length > 0 && (
            <div className="space-y-2">
              {blockedDates.map(d => (
                <div key={d} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarOff size={14} className="text-red-400" />
                    <span className="text-sm font-medium text-gray-700">
                      {new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-xs text-red-400 font-medium">Blocked</span>
                  </div>
                  <button
                    onClick={() => handleUnblockDate(d)}
                    className="text-xs text-violet-600 font-medium active:opacity-60"
                  >
                    Unblock
                  </button>
                </div>
              ))}
              <hr className="border-gray-100" />
            </div>
          )}

          <form onSubmit={handleBlockDate} className="flex gap-2">
            <input
              type="date"
              value={blockInput}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => { setBlockInput(e.target.value); setBlockConflicts([]); }}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="submit"
              disabled={!blockInput || blockPending}
              className="px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 active:bg-red-600 transition"
            >
              Block
            </button>
          </form>

          {autoDeclined.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-green-700">
                Auto-declined {autoDeclined.length} pending request{autoDeclined.length > 1 ? "s" : ""} for this day:
              </p>
              {autoDeclined.map(c => (
                <p key={c.id} className="text-xs text-green-600">{c.client_name}</p>
              ))}
            </div>
          )}

          {blockConflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700">
                ⚠️  {blockConflicts.length} confirmed appointment{blockConflicts.length > 1 ? "s" : ""} on this day — reschedule them manually:
              </p>
              {blockConflicts.map(c => (
                <p key={c.id} className="text-xs text-amber-600">
                  {c.client_name} —{" "}
                  {c.appointment_date
                    ? new Date(c.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                    : "TBD"}
                </p>
              ))}
            </div>
          )}
        </div>

        <Section title="Gap Fill Waitlist" />

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
          <p className="text-xs text-gray-400">
            These clients get a text when a slot opens due to a cancellation.
          </p>

          {waitlist.length > 0 && (
            <div className="space-y-2">
              {waitlist.map(e => (
                <div key={e.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{e.name}</p>
                    <p className="text-xs text-gray-400">{e.phone}</p>
                  </div>
                  <button
                    onClick={() => removeWaitlist(e.id)}
                    className="p-1.5 text-gray-300 active:text-red-400 transition"
                    aria-label="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              <hr className="border-gray-100" />
            </div>
          )}

          <form onSubmit={addWaitlist} className="flex gap-2">
            <input
              type="text"
              placeholder="Name"
              value={wlForm.name}
              onChange={e => setWlForm(f => ({ ...f, name: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={wlForm.phone}
              onChange={e => setWlForm(f => ({ ...f, phone: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="submit"
              disabled={wlAdding}
              className="px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 active:bg-violet-700 transition"
            >
              Add
            </button>
          </form>
        </div>

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
