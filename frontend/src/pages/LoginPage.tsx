import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

export default function LoginPage() {
  const { login, groomer } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (groomer) navigate("/");
  }, [groomer, navigate]);

  // Render Google Sign-In button once script is ready
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    function initGoogle() {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp: { credential: string }) => {
          try {
            const result = await api.googleAuth(resp.credential);
            login(result.token, result.groomer);
            navigate("/");
          } catch {
            setError("Google sign-in failed — try email instead");
          }
        },
      });
      const el = document.getElementById("google-btn");
      if (el) {
        window.google?.accounts.id.renderButton(el, { theme: "outline", size: "large", width: 320 });
      }
    }
    if (window.google) {
      initGoogle();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGoogle;
      document.head.appendChild(script);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.login(email, password);
      login(result.token, result.groomer);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">✂️</div>
        <h1 className="text-2xl font-bold text-gray-800">Welcome to Groomnice</h1>
        <p className="text-gray-500 text-sm mt-1">Sign in to your dashboard</p>
      </div>

      {GOOGLE_CLIENT_ID && (
        <>
          <div id="google-btn" className="flex justify-center mb-4" />
          <div className="flex items-center gap-3 mb-4">
            <hr className="flex-1 border-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <hr className="flex-1 border-gray-200" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={lbl}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" required autoComplete="email" className={inp} />
        </div>
        <div>
          <label className={lbl}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required autoComplete="current-password" className={inp} />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-semibold text-base disabled:opacity-50 transition active:bg-violet-700">
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        New groomer?{" "}
        <button onClick={() => navigate("/register")} className="text-violet-600 font-medium">
          Create account
        </button>
      </p>

      <p className="text-center text-xs text-gray-400 mt-3">
        Demo: demo@groomnice.com / demo1234
      </p>
    </Screen>
  );
}

const lbl = "block text-sm font-medium text-gray-700 mb-1.5";
const inp = "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-violet-400 bg-gray-50";

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-pink-50 p-5">
      <div className="bg-white rounded-3xl shadow-xl p-7 w-full max-w-sm">{children}</div>
    </div>
  );
}
