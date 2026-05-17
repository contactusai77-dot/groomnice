import { CalendarDays, List, Navigation, Plus, Scissors } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppointmentData, RouteData, RouteStop, SettingsData, WorkingHours, api } from "../api/client";
import AppointmentCard from "../components/AppointmentCard";
import BookingDrawer from "../components/BookingDrawer";

function generateSlots(wh: WorkingHours): string[] {
  const [sh, sm] = wh.start.split(":").map(Number);
  const [eh, em] = wh.end.split(":").map(Number);
  const slots: string[] = [];
  let cur = sh * 60 + sm;
  const end = eh * 60 + em;
  while (cur < end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    cur += wh.slot_minutes;
  }
  return slots;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function apptSlotKey(isoDate: string): string {
  const d = new Date(isoDate);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function DayView() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar" | "route">("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTime, setDrawerTime] = useState<string | undefined>(undefined);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  const load = useCallback(async () => {
    try {
      const [appts, s] = await Promise.all([api.getTodayAppointments(), api.getSettings()]);
      setAppointments(appts);
      setSettings(s);
      if (!s.onboarding_complete) navigate("/onboarding");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const ready = appointments.filter(a => a.ready).length;
  const earned = appointments
    .filter(a => a.status === "completed")
    .reduce((sum, a) => sum + (a.price ?? 0), 0);

  async function loadRoute() {
    setRouteLoading(true);
    try {
      setRoute(await api.getRoute());
    } finally {
      setRouteLoading(false);
    }
  }

  function switchView(v: "list" | "calendar" | "route") {
    setView(v);
    if (v === "route" && !route) loadRoute();
  }

  function openDrawerAt(time?: string) {
    setDrawerTime(time);
    setDrawerOpen(true);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div className="bg-white px-5 pt-14 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Scissors size={16} className="text-violet-500" />
            <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">
              Groomer Dashboard
            </span>
          </div>
          <div className="flex items-center gap-2">
            {earned > 0 && (
              <span className="text-sm font-semibold text-green-600">${earned} today</span>
            )}
            {/* List / Calendar / Route toggle */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => switchView("list")}
                className={`px-2.5 py-1.5 ${view === "list" ? "bg-violet-600 text-white" : "bg-white text-gray-400"} transition`}
                aria-label="List view"><List size={15} /></button>
              <button onClick={() => switchView("calendar")}
                className={`px-2.5 py-1.5 ${view === "calendar" ? "bg-violet-600 text-white" : "bg-white text-gray-400"} transition`}
                aria-label="Calendar view"><CalendarDays size={15} /></button>
              {settings?.is_mobile && (
                <button onClick={() => switchView("route")}
                  className={`px-2.5 py-1.5 ${view === "route" ? "bg-violet-600 text-white" : "bg-white text-gray-400"} transition`}
                  aria-label="Route view"><Navigation size={15} /></button>
              )}
            </div>
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{today}</h1>
        {appointments.length > 0 && (
          <p className="text-sm text-gray-400 mt-0.5">
            {ready} of {appointments.length} ready to groom
          </p>
        )}
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-16">Loading…</p>
        ) : view === "list" ? (
          appointments.length === 0 ? <Empty onAdd={() => openDrawerAt()} /> : (
            <>
              {appointments.filter(a => a.status === "pending_review").map(a => (
                <AppointmentCard key={a.id} appointment={a} onUpdate={load} />
              ))}
              {appointments.filter(a => a.status !== "pending_review").map(a => (
                <AppointmentCard key={a.id} appointment={a} onUpdate={load} />
              ))}
            </>
          )
        ) : view === "route" ? (
          <RouteView data={route} loading={routeLoading} onRefresh={loadRoute} />
        ) : (
          <CalendarView
            appointments={appointments}
            settings={settings}
            onUpdate={load}
            onBookSlot={openDrawerAt}
          />
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => openDrawerAt()}
        className="fixed right-5 bottom-24 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-violet-700 transition z-20"
        aria-label="New appointment"
      >
        <Plus size={26} />
      </button>

      <BookingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={load}
        initialTime={drawerTime}
      />
    </div>
  );
}

function CalendarView({
  appointments, settings, onUpdate, onBookSlot,
}: {
  appointments: AppointmentData[];
  settings: SettingsData | null;
  onUpdate: () => void;
  onBookSlot: (time: string) => void;
}) {
  if (!settings) return null;

  const wh = settings.working_hours;
  // Convert JS day (0=Sun) to Python weekday (0=Mon)
  const todayIdx = (new Date().getDay() + 6) % 7;
  const isWorkingDay = wh.days.includes(todayIdx);

  if (!isWorkingDay) {
    return (
      <div className="text-center py-16 text-gray-400">
        <CalendarDays size={32} className="mx-auto mb-3 opacity-40" />
        <p>Not a working day</p>
      </div>
    );
  }

  const slots = generateSlots(wh);
  const bySlot = new Map<string, AppointmentData>();
  for (const a of appointments) {
    if (a.appointment_date) bySlot.set(apptSlotKey(a.appointment_date), a);
  }

  const pendingReview = appointments.filter(a => a.status === "pending_review");

  return (
    <div className="space-y-3">
      {/* Pending online requests always shown at top */}
      {pendingReview.map(a => (
        <AppointmentCard key={a.id} appointment={a} onUpdate={onUpdate} />
      ))}

      {/* Time slot grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {slots.map((slot, i) => {
          const appt = bySlot.get(slot);
          const isLast = i === slots.length - 1;
          if (appt && appt.status !== "pending_review") {
            return (
              <div key={slot} className={`px-4 py-3 ${!isLast ? "border-b border-gray-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-16 shrink-0">{fmt12(slot)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{appt.pet_name}</p>
                    <p className="text-xs text-gray-400">{appt.service_type} · {appt.client_name}</p>
                  </div>
                  <StatusDot appt={appt} />
                </div>
              </div>
            );
          }
          return (
            <button
              key={slot}
              onClick={() => onBookSlot(slot)}
              className={`w-full px-4 py-3 flex items-center gap-3 active:bg-green-50 transition ${!isLast ? "border-b border-gray-50" : ""}`}
            >
              <span className="text-xs font-semibold text-gray-300 w-16 shrink-0">{fmt12(slot)}</span>
              <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                <Plus size={12} /> Available
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ appt }: { appt: AppointmentData }) {
  const color =
    appt.status === "completed" ? "bg-gray-300" :
    appt.status === "in_progress" ? "bg-blue-400" :
    appt.ready ? "bg-green-400" : "bg-amber-400";
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-3">✂️</div>
      <p className="text-gray-500 font-medium text-lg">No appointments today</p>
      <p className="text-gray-400 text-sm mt-1">Tap + to add one</p>
    </div>
  );
}

function RouteView({ data, loading, onRefresh }: { data: RouteData | null; loading: boolean; onRefresh: () => void }) {
  if (loading) return <p className="text-center text-gray-400 py-16">Calculating route…</p>;
  if (!data) return null;

  if (data.stops.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Navigation size={32} className="mx-auto mb-3 opacity-40" />
        <p>No appointments today</p>
      </div>
    );
  }

  if (!data.has_locations) {
    return (
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-center">
        <p className="text-amber-700 font-medium mb-1">No addresses on file</p>
        <p className="text-amber-600 text-sm">Add client addresses in the Clients tab to enable route optimization.</p>
        <p className="text-xs text-amber-500 mt-2">{data.stops.length} appointments today (showing in time order)</p>
      </div>
    );
  }

  function openMapsRoute() {
    const coords = data!.stops
      .filter(s => s.lat && s.lng)
      .map(s => `${s.lat},${s.lng}`)
      .join("/");
    window.open(`https://www.google.com/maps/dir/${coords}`, "_blank");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-gray-400">
          {data.geo_count} of {data.stops.length} stops mapped
        </p>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="text-xs text-violet-500 font-medium">Refresh</button>
          {data.has_locations && (
            <button onClick={openMapsRoute} className="text-xs text-blue-500 font-medium">Open in Maps →</button>
          )}
        </div>
      </div>

      {data.stops.map((stop, i) => (
        <RouteStopCard key={stop.booking_id} stop={stop} index={i} />
      ))}
    </div>
  );
}

function RouteStopCard({ stop, index }: { stop: RouteStop; index: number }) {
  const time = stop.appointment_date
    ? new Date(stop.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "TBD";

  return (
    <div>
      {index > 0 && stop.drive_minutes != null && (
        <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-gray-400">
          <Navigation size={11} />
          <span>{stop.drive_minutes} min · {stop.drive_miles} mi</span>
        </div>
      )}
      {index > 0 && stop.drive_minutes == null && stop.address && (
        <div className="flex items-center gap-2 px-4 py-1 text-xs text-gray-300">
          <Navigation size={11} />
          <span>—</span>
        </div>
      )}
      <div className="bg-white rounded-2xl px-4 py-3 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{time}</span>
              <span className="text-xs text-gray-400">{stop.service_type}</span>
            </div>
            <p className="text-sm font-medium text-gray-700">{stop.pet_name} · {stop.client_name}</p>
            {stop.address
              ? <p className="text-xs text-gray-400 truncate">📍 {stop.address}</p>
              : <p className="text-xs text-amber-400">No address — add in Clients tab</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
