import axios from "axios";

const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] ?? "http://localhost:5000/api/v1";
const RFID_BASE_URL = import.meta.env["VITE_RFID_API_BASE_URL"] ?? "http://localhost:8000";

// ─── Main API client (Express backend) ───────────────────────────────────────
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("smartlib_token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear token and redirect to login only for authenticated requests
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || "";
    const isHealthCheck = url.includes("/health");
    if (error.response?.status === 401 && !isHealthCheck && typeof window !== "undefined") {
      const isPublicOrLogin =
        window.location.pathname === "/login" || window.location.pathname.startsWith("/opac");
      if (!isPublicOrLogin) {
        localStorage.removeItem("smartlib_token");
        localStorage.removeItem("smartlib_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── RFID middleware client ───────────────────────────────────────────────────
export const rfidApi = axios.create({
  baseURL: RFID_BASE_URL,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
});

// ─── Health check with concurrency deduplication ──────────────────────────────
let activeHealthCheck: Promise<any> | null = null;

export async function checkBackendHealth(): Promise<any> {
  if (activeHealthCheck) {
    return activeHealthCheck;
  }
  activeHealthCheck = api
    .get("/health", { timeout: 5000 })
    .then((res) => {
      activeHealthCheck = null;
      return res.data;
    })
    .catch((err) => {
      activeHealthCheck = null;
      throw err;
    });
  return activeHealthCheck;
}

let activeRfidHealthCheck: Promise<any> | null = null;
let preferredRfidBaseUrl: string = RFID_BASE_URL;

export async function checkRfidHealth(): Promise<any> {
  if (activeRfidHealthCheck) {
    return activeRfidHealthCheck;
  }

  activeRfidHealthCheck = (async () => {
    // Primary target: configured RFID_BASE_URL (http://localhost:8000)
    // Fallback candidates: 127.0.0.1 (handles Windows IPv6 ::1 localhost resolution), and /rfid (Vite proxy)
    const candidateUrls = [
      preferredRfidBaseUrl,
      preferredRfidBaseUrl.includes("localhost")
        ? preferredRfidBaseUrl.replace("localhost", "127.0.0.1")
        : "http://localhost:8000",
      "/rfid",
    ];

    const uniqueCandidates = Array.from(new Set(candidateUrls));
    let lastError: any = null;

    for (const baseUrl of uniqueCandidates) {
      try {
        const res = await axios.get(`${baseUrl}/health`, {
          timeout: 10000, // 10s timeout gracefully accommodates backend outage probe delays
          headers: { "Content-Type": "application/json" },
        });

        if (res.status === 200 && res.data) {
          preferredRfidBaseUrl = baseUrl;
          if (baseUrl !== "/rfid") {
            rfidApi.defaults.baseURL = baseUrl;
          }
          return res.data;
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("RFID Middleware service unreachable");
  })().finally(() => {
    activeRfidHealthCheck = null;
  });

  return activeRfidHealthCheck;
}

// ─── Typed helper functions ───────────────────────────────────────────────────
export async function apiGet<T>(
  url: string,
  params?: Record<string, unknown>,
  config?: { timeout?: number }
): Promise<T> {
  const res = await api.get<T>(url, { params, ...config });
  const data = res.data as any;
  if (data && typeof data === "object") {
    if (data.meta && !data.pagination) {
      data.pagination = data.meta;
    } else if (data.pagination && !data.meta) {
      data.meta = data.pagination;
    }
  }
  return data;
}

export async function apiPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await api.post<T>(url, data);
  return res.data;
}

export async function apiUpload<T>(url: string, formData: FormData): Promise<T> {
  const res = await api.post<T>(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function apiPut<T>(url: string, data?: unknown): Promise<T> {
  const res = await api.put<T>(url, data);
  return res.data;
}

export async function apiDelete<T>(url: string): Promise<T> {
  const res = await api.delete<T>(url);
  return res.data;
}

export async function apiDownload(
  url: string,
  params?: Record<string, unknown>,
  defaultFilename = "smartlib-report"
): Promise<{ blob: Blob; filename: string }> {
  const res = await api.get(url, {
    params,
    responseType: "blob",
    timeout: 60000,
  });
  let filename = defaultFilename;
  const disposition = res.headers["content-disposition"];
  if (disposition && typeof disposition === "string") {
    const match = disposition.match(/filename="?([^"]+)"?/i);
    if (match && match[1]) {
      filename = match[1];
    }
  }
  return { blob: res.data as Blob, filename };
}

export async function rfidGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await rfidApi.get<T>(url, { params });
  return res.data;
}

export async function rfidPost<T>(url: string, data?: unknown): Promise<T> {
  const res = await rfidApi.post<T>(url, data);
  return res.data;
}

