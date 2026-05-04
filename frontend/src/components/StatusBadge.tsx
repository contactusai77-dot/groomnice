type BadgeStatus =
  | "ready"
  | "missing_vaccine"
  | "missing_deposit"
  | "in_progress"
  | "completed"
  | "canceled"
  | "pending_payment";

const cfg: Record<BadgeStatus, { bg: string; text: string; dot: string; label: string }> = {
  ready:            { bg: "bg-green-50",  text: "text-green-700",  dot: "bg-green-500",  label: "Ready"       },
  missing_vaccine:  { bg: "bg-red-50",    text: "text-red-700",    dot: "bg-red-500",    label: "No Vaccine"  },
  missing_deposit:  { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-500",  label: "No Deposit"  },
  pending_payment:  { bg: "bg-amber-50",  text: "text-amber-700",  dot: "bg-amber-400",  label: "Unpaid"      },
  in_progress:      { bg: "bg-blue-50",   text: "text-blue-700",   dot: "bg-blue-500",   label: "Grooming"    },
  completed:        { bg: "bg-gray-50",   text: "text-gray-500",   dot: "bg-gray-400",   label: "Done"        },
  canceled:         { bg: "bg-gray-50",   text: "text-gray-400",   dot: "bg-gray-300",   label: "Canceled"    },
};

export default function StatusBadge({ status, label }: { status: BadgeStatus; label?: string }) {
  const c = cfg[status] ?? cfg.pending_payment;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
      {label ?? c.label}
    </span>
  );
}
