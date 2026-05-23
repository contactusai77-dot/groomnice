import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

interface PendingCtx { count: number; refresh: () => void; }
const Ctx = createContext<PendingCtx>({ count: 0, refresh: () => {} });

export function PendingProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const appts = await api.getTodayAppointments();
      setCount(appts.filter(a => a.status === "pending_review").length);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return <Ctx.Provider value={{ count, refresh }}>{children}</Ctx.Provider>;
}

export const usePending = () => useContext(Ctx);
