function getToken(): string | null {
  return localStorage.getItem("groomnice_token");
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ── Auth types ────────────────────────────────────────────────────────────────

export interface GroomerInfo {
  id: string;
  name: string;
  email: string;
  slug: string;
}

export interface AuthResult {
  token: string;
  groomer: GroomerInfo;
}

// ── Customer-facing types ─────────────────────────────────────────────────────

export interface BookingResponse {
  booking_id: string;
  message: string;
}

export interface PetData {
  id: string;
  pet_name: string | null;
  breed: string | null;
  age: string | null;
  weight: string | null;
  emergency_contact: string | null;
  notes: string | null;
  rabies_expiry: string | null;
  profile_complete: boolean;
  temperament: "friendly" | "anxious" | "aggressive";
}

export interface PriceEstimate {
  price: number | null;
  duration_minutes: number;
  notes: string;
  error?: boolean;
}

export interface RouteStop {
  booking_id: string;
  client_name: string;
  client_phone: string;
  pet_name: string;
  service_type: string;
  appointment_date: string | null;
  status: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  drive_minutes: number | null;
  drive_miles: number | null;
}

export interface RouteData {
  stops: RouteStop[];
  has_locations: boolean;
  geo_count: number;
}

export interface PetFormData {
  pet_name?: string | null;
  breed?: string | null;
  age?: string | null;
  weight?: string | null;
  emergency_contact?: string | null;
  notes?: string | null;
}

export interface ProfileData {
  client_name: string;
  pets: PetData[];
}

export interface VaccineResult {
  rabies_expiry: string | null;
  needs_review: boolean;
  message: string;
}

// ── Groomer-facing types ──────────────────────────────────────────────────────

export interface AppointmentData {
  id: string;
  appointment_date: string | null;
  service_type: string;
  status: string;
  price: number | null;
  client_name: string;
  client_phone: string;
  pet_name: string;
  breed: string | null;
  vaccine_ok: boolean;
  deposit_ok: boolean;
  ready: boolean;
  profile_complete: boolean;
  intake_token: string | null;
  pet_id: string | null;
  temperament: "friendly" | "anxious" | "aggressive";
  source: string;
}

export interface BookingSlot {
  date: string;
  day_name: string;
  slots: string[];
}

export interface OnlineBookingResult {
  booking_id: string;
  intake_token: string;
  status: string;
}

export interface ClientData {
  id: string;
  name: string;
  phone: string;
  intake_token: string;
  address: string | null;
  pets: PetData[];
  vaccine_ok: boolean;
  last_visit: string | null;
}

export interface WorkingHours {
  days: number[];
  start: string;
  end: string;
  slot_minutes: number;
}

export interface SettingsData {
  require_deposit: boolean;
  send_24h_reminder: boolean;
  send_gap_fill_text: boolean;
  deposit_amount: number;
  service_prices: Record<string, number>;
  working_hours: WorkingHours;
  onboarding_complete: boolean;
  is_mobile: boolean;
}

export interface WaitlistEntryData {
  id: string;
  phone: string;
  name: string;
}

export interface RevenuePeriod { revenue: number; count: number; }
export interface RevenueData {
  today: RevenuePeriod;
  week: RevenuePeriod;
  month: RevenuePeriod;
  by_service: Record<string, RevenuePeriod>;
}

export interface ImportIssue {
  row: number;
  type: "no_phone" | "bad_phone" | "missing_name" | "bad_date" | "duplicate_phone";
  field: string;
  value: string;
  detail: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  issues: ImportIssue[];
}

export interface VaultSubmission {
  id: string;
  client_name: string;
  pet_name: string;
  image_url: string | null;
  ai_expiry: string | null;
  status: string;
  created_at: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  register: (email: string, password: string, name: string, slug: string) =>
    request<AuthResult>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name, slug }),
    }),

  login: (email: string, password: string) =>
    request<AuthResult>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  googleAuth: (credential: string) =>
    request<AuthResult>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ credential }),
    }),

  getMe: () => request<GroomerInfo>("/auth/me"),

  // Customer
  createBooking: (phone: string, name: string) =>
    request<BookingResponse>("/bookings", { method: "POST", body: JSON.stringify({ phone, name }) }),

  getProfile: (token: string) => request<ProfileData>(`/profile/${token}`),

  saveProfile: (token: string, data: PetFormData) =>
    request<{ success: boolean }>(`/profile/${token}`, { method: "PUT", body: JSON.stringify(data) }),

  addPet: (token: string, data: PetFormData) =>
    request<{ success: boolean; pet_id: string }>(`/profile/${token}/pets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePet: (token: string, petId: string, data: PetFormData) =>
    request<{ success: boolean }>(`/profile/${token}/pets/${petId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  uploadVaccine: async (token: string, file: File, petId?: string): Promise<VaccineResult> => {
    const form = new FormData();
    form.append("file", file);
    const url = petId ? `/api/vaccine/${token}?pet_id=${petId}` : `/api/vaccine/${token}`;
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  // Groomer dashboard
  getTodayAppointments: () => request<AppointmentData[]>("/appointments/today"),

  quickBooking: (data: {
    phone: string;
    client_name: string;
    pet_name: string;
    service_type: string;
    appointment_time: string;
  }) => request<{ booking_id: string; intake_token: string }>("/bookings/quick", { method: "POST", body: JSON.stringify(data) }),

  updateBookingStatus: (id: string, status: string) =>
    request<{ success: boolean }>(`/bookings/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  // Clients
  getClients: () => request<ClientData[]>("/clients"),

  // Vaccine vault
  getVaccineVault: () => request<VaultSubmission[]>("/vaccine-vault"),

  confirmVaccine: (id: string, expiry: string) =>
    request<{ success: boolean }>(`/vaccine-vault/${id}/confirm`, {
      method: "PATCH",
      body: JSON.stringify({ expiry }),
    }),

  // History + Revenue
  getHistory: (q?: string, days?: number) =>
    request<AppointmentData[]>(`/appointments/history?q=${encodeURIComponent(q ?? "")}&days=${days ?? 60}`),

  getRevenue: () => request<RevenueData>("/revenue"),

  // Online booking (customer-facing, keyed by groomer slug)
  getBookingSlots: (slug: string) => request<BookingSlot[]>(`/book/${slug}/slots`),

  onlineBook: (
    slug: string,
    data: {
      phone: string;
      name: string;
      pet_name: string;
      service_type: string;
      slot_date: string;
      slot_time: string;
    },
  ) => request<OnlineBookingResult>(`/book/${slug}`, { method: "POST", body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request<SettingsData>("/settings"),

  updateSettings: (data: Partial<SettingsData>) =>
    request<{ success: boolean }>("/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Waitlist
  getWaitlist: () => request<WaitlistEntryData[]>("/waitlist"),
  addWaitlist: (phone: string, name: string) =>
    request<WaitlistEntryData>("/waitlist", { method: "POST", body: JSON.stringify({ phone, name }) }),
  removeWaitlist: (id: string) =>
    request<{ success: boolean }>(`/waitlist/${id}`, { method: "DELETE" }),

  // Edit client / pet (groomer)
  updateClient: (id: string, data: { name: string; phone: string; address?: string }) =>
    request<{ success: boolean }>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  updatePetGroomer: (petId: string, data: { pet_name: string; breed: string; age: string; weight: string; notes: string; temperament: string; rabies_expiry: string }) =>
    request<{ success: boolean }>(`/pets/${petId}`, { method: "PATCH", body: JSON.stringify(data) }),

  priceEstimate: (data: { breed: string; service_type: string; temperament: string; coat_condition: string }) =>
    request<PriceEstimate>("/price-estimate", { method: "POST", body: JSON.stringify(data) }),

  getRoute: () => request<RouteData>("/route/today"),

  submitFeedback: (data: { email: string; type: string; message: string }) =>
    request<{ success: boolean }>("/feedback", { method: "POST", body: JSON.stringify(data) }),

  importPreview: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const token = localStorage.getItem("groomnice_token");
    const res = await fetch("/api/import/preview", {
      method: "POST",
      body: form,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{
      columns: string[];
      total_rows: number;
      sample_rows: Record<string, string>[];
      suggested_mapping: Record<string, string>;
    }>;
  },

  importApply: (rows: Record<string, string>[], mapping: Record<string, string>) =>
    request<ImportResult>("/import/apply", {
      method: "POST",
      body: JSON.stringify({ rows, mapping }),
    }),
};
