import { Calendar, ShieldCheck, Users, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const tabs = [
  { path: "/",        icon: Calendar,     label: "Today"   },
  { path: "/clients", icon: Users,        label: "Clients" },
  { path: "/vault",   icon: ShieldCheck,  label: "Vault"   },
  { path: "/settings",icon: Settings,     label: "Settings"},
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-30">
      {tabs.map(({ path, icon: Icon, label }) => {
        const active = pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
              active ? "text-violet-600" : "text-gray-400"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
