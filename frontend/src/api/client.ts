async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
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
  pets: PetData[];
  vaccine_ok: boolean;
  last_visit: string | null;
}

export interface WorkingHours {
  days: number[];       // 0=Mon … 6=Sun
  start: string;        // "HH:MM"
  end: string;          // "HH:MM"
  slot_minutes: number;
}

export interface SettingsData {
  require_deposit: boolean;
  send_24h_reminder: boolean;
  send_gap_fill_text: boolean;
  deposit_amount: number;
  service_prices: Record<string, number>;
  working_hours: WorkingHours;
}

export interface RevenuePeriod { revenue: number; count: number; }
export interface RevenueData {
  today: RevenuePeriod;
  week: RevenuePeriod;
  month: RevenuePeriod;
  by_service: Record<string, RevenuePeriod>;
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

  // Online booking (customer-facing)
  getBookingSlots: () => request<BookingSlot[]>("/book/slots"),

  onlineBook: (data: {
    phone: string;
    name: string;
    pet_name: string;
    service_type: string;
    slot_date: string;
    slot_time: string;
  }) => request<OnlineBookingResult>("/book", { method: "POST", body: JSON.stringify(data) }),

  // Settings
  getSettings: () => request<SettingsData>("/settings"),

  updateSettings: (data: Partial<SettingsData>) =>
    request<{ success: boolean }>("/settings", { method: "PATCH", body: JSON.stringify(data) }),

  // Edit client / pet (groomer)
  updateClient: (id: string, data: { name: string; phone: string }) =>
    request<{ success: boolean }>(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  updatePetGroomer: (petId: string, data: { pet_name: string; breed: string; age: string; weight: string; notes: string }) =>
    request<{ success: boolean }>(`/pets/${petId}`, { method: "PATCH", body: JSON.stringify(data) }),
};
