import { CheckCircle, DollarSign, MessageCircle, Scissors } from "lucide-react";
import { AppointmentData, api } from "../api/client";
import StatusBadge from "./StatusBadge";

type BadgeStatus = "ready" | "missing_vaccine" | "missing_deposit" | "in_progress" | "completed" | "canceled" | "pending_payment";

function badgeFor(a: AppointmentData): BadgeStatus {
  if (a.status === "completed") return "completed";
  if (a.status === "canceled")  return "canceled";
  if (a.status === "in_progress") return "in_progress";
  if (!a.vaccine_ok)  return "missing_vaccine";
  if (!a.deposit_ok)  return "missing_deposit";
  return "ready";
}

interface Props {
  appointment: AppointmentData;
  onUpdate: () => void;
}

export default function AppointmentCard({ appointment: a, onUpdate }: Props) {
  const time = a.appointment_date
    ? new Date(a.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "TBD";

  function handleText() {
    const body = encodeURIComponent(`Hi ${a.client_name}! Just a reminder about your grooming appointment today. See you soon!`);
    window.open(`sms:${a.client_phone}?body=${body}`);
  }

  async function handleToggleGroom() {
    const next = a.status === "in_progress" ? "completed" : "in_progress";
    await api.updateBookingStatus(a.id, next);
    onUpdate();
  }

  async function handleMarkPaid() {
    await api.updateBookingStatus(a.id, "confirmed");
    onUpdate();
  }

  const done = a.status === "completed" || a.status === "canceled";

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 ${done ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-gray-800">{time}</span>
            <span className="text-sm text-gray-400">{a.service_type}</span>
          </div>
          <p className="text-base font-semibold text-gray-800 mt-0.5 truncate">
            {a.pet_name || "Unknown Pet"}
          </p>
          {a.breed && <p className="text-sm text-gray-400">{a.breed}</p>}
          <p className="text-sm text-gray-500 mt-0.5">{a.client_name}</p>
        </div>
        <StatusBadge status={badgeFor(a)} />
      </div>

      {/* Quick actions */}
      {!done && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          <Btn icon={<MessageCircle size={15} />} label="Text" color="gray" onClick={handleText} />
          <Btn
            icon={a.status === "in_progress" ? <CheckCircle size={15} /> : <Scissors size={15} />}
            label={a.status === "in_progress" ? "Done" : "Start"}
            color="violet"
            onClick={handleToggleGroom}
          />
          {!a.deposit_ok && (
            <Btn icon={<DollarSign size={15} />} label="Mark Paid" color="green" onClick={handleMarkPaid} />
          )}
        </div>
      )}
    </div>
  );
}

function Btn({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string;
  color: "gray" | "violet" | "green"; onClick: () => void;
}) {
  const cls = {
    gray:   "bg-gray-50  text-gray-600  active:bg-gray-100",
    violet: "bg-violet-50 text-violet-600 active:bg-violet-100",
    green:  "bg-green-50 text-green-600  active:bg-green-100",
  }[color];
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium ${cls}`}>
      {icon}{label}
    </button>
  );
}
