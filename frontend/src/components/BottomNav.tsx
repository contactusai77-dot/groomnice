import { Bell, Calendar, Settings, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePending } from "../context/PendingContext";

const tabs = [
  { path: "/",         icon: Calendar,    label: "Today"    },
  { path: "/requests", icon: Bell,        label: "Requests" },
  { path: "/clients",  icon: Users,       label: "Clients"  },
  { path: "/reports",  icon: TrendingUp,  label: "Reports"  },
  { path: "/settings", icon: Settings,    label: "Settings" },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { count } = usePending();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-30 safe-bottom">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = pathname === path;
        const isRequests = path === "/requests";
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
              active ? "text-violet-600" : "text-gray-400"
            }`}
          >
            <div className="relative">
              <Icon size={20} strokeWidth={active ? 2.5 : 1.5} />
              {isRequests && count > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
