import { CheckCircle, DollarSign, MessageCircle, Scissors, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { AppointmentData, api } from "../api/client";
import StatusBadge from "./StatusBadge";

type BadgeStatus = "ready" | "missing_vaccine" | "missing_deposit" | "in_progress" | "completed" | "canceled" | "pending_payment" | "pending_review";

function badgeFor(a: AppointmentData): BadgeStatus {
  if (a.status === "completed") return "completed";
  if (a.status === "canceled")  return "canceled";
  if (a.status === "in_progress") return "in_progress";
  if (a.status === "pending_review") return "pending_review";
  if (!a.vaccine_ok)  return "missing_vaccine";
  if (!a.deposit_ok)  return "missing_deposit";
  return "ready";
}

interface Props {
  appointment: AppointmentData;
  onUpdate: () => void;
}

export default function AppointmentCard({ appointment: a, onUpdate }: Props) {
  const [shareStatus, setShareStatus] = useState<"idle" | "copied">("idle");

  const time = a.appointment_date
    ? new Date(a.appointment_date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "TBD";

  async function handleRequestVaccine() {
    const url = `${window.location.origin}/vaccine/${a.intake_token}${a.pet_id ? `?pet_id=${a.pet_id}` : ""}`;
    const text = `Hi ${a.client_name}! To confirm your grooming appointment we need ${a.pet_name}'s up-to-date vaccine record. Tap the link to upload a quick photo — takes 30 seconds: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // user cancelled or share unsupported — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setShareStatus("copied");
    setTimeout(() => setShareStatus("idle"), 2000);
  }

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
  const isPending = a.status === "pending_review";

  async function handleConfirm() {
    await api.updateBookingStatus(a.id, "confirmed");
    onUpdate();
  }

  async function handleDecline() {
    await api.updateBookingStatus(a.id, "declined");
    onUpdate();
  }

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border ${isPending ? "border-amber-200 bg-amber-50/30" : "border-gray-100"} ${done ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl font-bold text-gray-800">{time}</span>
            <span className="text-sm text-gray-400">{a.service_type}</span>
            {a.source === "online" && (
              <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">Online</span>
            )}
          </div>
          <p className="text-base font-semibold text-gray-800 mt-0.5 truncate">
            {a.pet_name || "Unknown Pet"}
          </p>
          {a.breed && <p className="text-sm text-gray-400">{a.breed}</p>}
          <p className="text-sm text-gray-500 mt-0.5">{a.client_name}</p>
        </div>
        <StatusBadge status={badgeFor(a)} />
      </div>

      {/* Pending online booking: confirm or decline */}
      {isPending && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-amber-100">
          <Btn icon={<CheckCircle size={15} />} label="Confirm" color="green" onClick={handleConfirm} />
          <Btn icon={<X size={15} />} label="Decline" color="red" onClick={handleDecline} />
          <Btn icon={<MessageCircle size={15} />} label="Text" color="gray" onClick={handleText} />
        </div>
      )}

      {/* Regular grooming actions */}
      {!done && !isPending && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 flex-wrap">
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
          {!a.vaccine_ok && a.intake_token && (
            <Btn
              icon={<ShieldAlert size={15} />}
              label={shareStatus === "copied" ? "Link Copied!" : "Request Vaccine"}
              color="amber"
              onClick={handleRequestVaccine}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Btn({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string;
  color: "gray" | "violet" | "green" | "red" | "amber"; onClick: () => void;
}) {
  const cls = {
    gray:   "bg-gray-50  text-gray-600  active:bg-gray-100",
    violet: "bg-violet-50 text-violet-600 active:bg-violet-100",
    green:  "bg-green-50 text-green-600  active:bg-green-100",
    red:    "bg-red-50   text-red-500    active:bg-red-100",
    amber:  "bg-amber-50 text-amber-600  active:bg-amber-100",
  }[color];
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium ${cls}`}>
      {icon}{label}
    </button>
  );
}
