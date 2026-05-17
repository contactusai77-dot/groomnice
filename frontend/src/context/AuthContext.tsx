import { createContext, useContext, useEffect, useState } from "react";
import { GroomerInfo, api } from "../api/client";

interface AuthContextValue {
  groomer: GroomerInfo | null;
  loading: boolean;
  login: (token: string, groomer: GroomerInfo) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  groomer: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [groomer, setGroomer] = useState<GroomerInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("groomnice_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api.getMe()
      .then(setGroomer)
      .catch(() => localStorage.removeItem("groomnice_token"))
      .finally(() => setLoading(false));
  }, []);

  function login(token: string, info: GroomerInfo) {
    localStorage.setItem("groomnice_token", token);
    setGroomer(info);
  }

  function logout() {
    localStorage.removeItem("groomnice_token");
    setGroomer(null);
  }

  return (
    <AuthContext.Provider value={{ groomer, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
