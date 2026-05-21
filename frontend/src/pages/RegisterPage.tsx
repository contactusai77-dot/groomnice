import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { login, groomer } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [dataConsent, setDataConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (groomer) navigate("/");
  }, [groomer, navigate]);

  // Auto-generate slug from business name
  useEffect(() => {
    if (!slugEdited && name) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  }, [name, slugEdited]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.register(email, password, name, slug, tosAccepted, dataConsent);
      login(result.token, result.groomer);
      navigate("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      try {
        setError(JSON.parse(msg)?.detail ?? msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">✂️</div>
        <h1 className="text-2xl font-bold text-gray-800">Create your account</h1>
        <p className="text-gray-500 text-sm mt-1">Free to start — no card required</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={lbl}>Your Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Sarah Johnson" required autoComplete="name" className={inp} />
        </div>
        <div>
          <label className={lbl}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="sarah@example.com" required autoComplete="email" className={inp} />
        </div>
        <div>
          <label className={lbl}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" required minLength={6} autoComplete="new-password" className={inp} />
        </div>
        <div>
          <label className={lbl}>
            Booking URL handle
            <span className="text-gray-400 font-normal ml-1 text-xs">(customers will visit /book/your-slug)</span>
          </label>
          <div className="flex items-center border border-gray-200 rounded-xl bg-gray-50 focus-within:ring-2 focus-within:ring-violet-400 overflow-hidden">
            <span className="pl-4 text-gray-400 text-sm whitespace-nowrap">groomnice.com/book/</span>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugEdited(true); }}
              placeholder="sarahs-paws"
              required
              pattern="[a-z0-9][a-z0-9-]*"
              className="flex-1 bg-transparent px-2 py-3 text-base focus:outline-none"
            />
          </div>
        </div>

        {/* Consent checkboxes */}
        <div className="space-y-3 pt-1">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={tosAccepted}
              onChange={e => setTosAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-violet-600 shrink-0"
              required
            />
            <span className="text-sm text-gray-600">
              I agree to the{" "}
              <a href="/terms" target="_blank" className="text-violet-600 underline font-medium">
                Terms of Service
              </a>
              . I understand that Groomnice is a scheduling platform, AI outputs may contain errors,
              and my liability for any claims is capped at fees paid.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dataConsent}
              onChange={e => setDataConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-violet-600 shrink-0"
              required
            />
            <span className="text-sm text-gray-600">
              I consent to Groomnice collecting and processing my business data (client records,
              appointments, uploaded files) to provide the service, as described in the{" "}
              <a href="/privacy" target="_blank" className="text-violet-600 underline font-medium">
                Privacy Policy
              </a>.
            </span>
          </label>
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button type="submit" disabled={loading || !tosAccepted || !dataConsent}
          className="w-full bg-violet-600 text-white py-3.5 rounded-xl font-semibold text-base disabled:opacity-50 transition active:bg-violet-700">
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{" "}
        <button onClick={() => navigate("/login")} className="text-violet-600 font-medium">
          Sign in
        </button>
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
