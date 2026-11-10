# SmartLib — RFID Middleware Connection Status & Backend Outage Verification Report

**Project**: SmartLib — RFID-Enabled Integrated Library Management System  
**Document Ref**: `docs/RFID_CONNECTION_FIX_REPORT.md`  
**Date**: November 7, 2026  
**Status**: VERIFIED & PRODUCTION READY  
**Component**: Frontend Dashboard Health Telemetry & RFID Hardware Middleware Edge Client  

---

## Executive Summary

An investigation was conducted into the SmartLib frontend dashboard displaying `RFID Middleware: Offline` while the FastAPI RFID middleware service was confirmed running nominal at `http://127.0.0.1:8000` with local SQLite buffering initialized (`./data/offline_events.db`).

The root causes were isolated, resolved in the frontend client layer without modifying working hardware drivers or the SQLite buffer, and verified via end-to-end automated Playwright tests. The dashboard now reliably displays:
1. **Online Detection**: `RFID Middleware: ONLINE` (green badge with live pulse indicator) upon receiving HTTP 200 from `http://localhost:8000/health` (or `http://127.0.0.1:8000/health`).
2. **Backend Outage Grace**: When the Express backend is stopped or experiencing an outage, the RFID middleware is **still detected as ONLINE** with sub-label `(Offline Buffer Active)`.
3. **Resilient Dual-Host Fallback**: Probes `http://localhost:8000`, seamlessly falling back to `http://127.0.0.1:8000` or `/rfid` proxy if Windows IPv6 loopback resolution causes connection refusals.
4. **Auto-Reconnection**: Reconnects to `Online` within 5 seconds when the RFID service is restarted.

---

## 1. Investigation & Root Cause Analysis

### 1.1 Actual RFID Middleware `/health` Response
Direct inspection of `rfid-service/main.py` and `rfid-service/schemas.py` confirms that `GET /health` returns an un-enveloped JSON structure:

```json
{
  "status": "HEALTHY",
  "service": "smartlib-rfid-middleware",
  "version": "1.0.0-phase2b",
  "mock_hardware": true,
  "backend_connected": true,
  "backend_url": "http://localhost:5000/api/v1",
  "buffer_path": "./data/offline_events.db",
  "pending_events": 0,
  "devices_online": 3,
  "uptime_seconds": 142.5,
  "timestamp": "2026-11-07T08:46:36.883071Z"
}
```

Key characteristics:
- It returns direct top-level keys (`status`, `service`, `backend_connected`, `devices_online`), unlike the Express backend which wraps results in `{ success: true, data: { ... } }`.
- When the Express backend is offline, `backend_connected` becomes `false`, but `status` **remains `"HEALTHY"`** because edge mock hardware drivers and local SQLite queuing remain operational.

---

### 1.2 Root Cause 1: Premature Frontend Timeout During Backend Outages
In `rfid-service/main.py`:
```python
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    backend_alive = await probe_backend()
    ...
```
When the Express backend on port 5000 is stopped:
1. `probe_backend()` calls `client.get("/health")` against `http://localhost:5000/api/v1/health`.
2. `rfid-service/config.py` sets `backend_request_timeout: 10` (10 seconds).
3. On Windows, attempting to connect to a stopped port encounters TCP connection retries before timing out (up to 2–10 seconds).
4. **The Bug**: `checkRfidHealth()` in `frontend/src/lib/api.ts` configured Axios with `{ timeout: 5000 }` (5 seconds).
5. **Impact**: Whenever the backend was down, the frontend aborted the RFID health check at 5,000ms with `ECONNABORTED: timeout of 5000ms exceeded` before FastAPI could reply with its nominal `{ status: "HEALTHY", backend_connected: false }`. TanStack Query caught the timeout and marked the RFID middleware as **Offline**!

---

### 1.3 Root Cause 2: Windows IPv6 `localhost` (`::1`) Loopback Socket Refusal
When Uvicorn is launched via `python -m uvicorn main:app --port 8000`:
- Uvicorn binds strictly to IPv4 `127.0.0.1:8000`.
- On Windows 10/11, Google Chrome and Chromium resolve `http://localhost:8000` to IPv6 `[::1]:8000` first.
- If Uvicorn is not listening on IPv6, Windows immediately resets the TCP connection (`WSAECONNREFUSED` / `ERR_CONNECTION_REFUSED`).
- The frontend was sending cross-origin requests to `http://localhost:8000` without IPv4 `127.0.0.1` fallback or dev proxy fallback.

---

### 1.4 Root Cause 3: Response Interpretation in Dashboard
`Dashboard.tsx` previously evaluated:
```typescript
// BEFORE: Faulty query typing and incomplete operational check
const rfidOnline = !rfidError && rfidSuccess && !!rfidHealth?.status;
```
1. `rfidHealth` was typed generically as `{ status?: string }`, ignoring `backend_connected` and `devices_online`.
2. When backend outages occurred, there was no indicator informing library staff that the RFID middleware was operating in **Offline Buffer Mode**, causing confusion about system health.

---

## 2. Solutions Implemented

### 2.1 Dedicated Typed Health Schema (`frontend/src/types/index.ts`)
```typescript
export interface RfidHealthResponse {
  status: string; // "HEALTHY"
  service: string; // "smartlib-rfid-middleware"
  version: string;
  mock_hardware: boolean;
  backend_connected: boolean;
  backend_url: string;
  buffer_path: string;
  pending_events: number;
  devices_online: number;
  uptime_seconds: number;
  timestamp: string;
  [key: string]: unknown;
}
```

### 2.2 Resilient Multi-Host Probing & 10s Timeout (`frontend/src/lib/api.ts`)
Updated `checkRfidHealth()` to:
1. Always check the primary configured URL: `http://localhost:8000/health`.
2. Extend timeout from 5s to **10,000ms (10 seconds)** to comfortably accommodate edge backend probe latencies during outages.
3. Automatically fall back to `http://127.0.0.1:8000/health` if `localhost` fails due to Windows IPv6 connection refusal.
4. Fall back to Vite dev server proxy `/rfid/health` if direct browser CORS is blocked.
5. Dynamically remember the working candidate for subsequent fleet and scanning API calls.

```typescript
let activeRfidHealthCheck: Promise<any> | null = null;
let preferredRfidBaseUrl: string = RFID_BASE_URL;

export async function checkRfidHealth(): Promise<any> {
  if (activeRfidHealthCheck) return activeRfidHealthCheck;

  activeRfidHealthCheck = (async () => {
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
          timeout: 10000,
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
```

### 2.3 Transparent Edge Buffer Telemetry (`frontend/src/pages/Dashboard.tsx`)
Updated the connection evaluation to recognize both nominal and buffered offline states:
```typescript
const {
  data: rfidHealth,
  isSuccess: rfidSuccess,
  isError: rfidError,
  status: rfidQueryStatus,
} = useQuery<RfidHealthResponse>({
  queryKey: ["health", "rfid"],
  queryFn: checkRfidHealth,
  retry: 2,
  retryDelay: 1000,
  refetchInterval: 5_000,
  refetchIntervalInBackground: true,
  staleTime: 0,
});

const rfidOnline =
  !rfidError &&
  rfidSuccess &&
  rfidQueryStatus === "success" &&
  (rfidHealth?.status === "HEALTHY" ||
    rfidHealth?.status === "ONLINE" ||
    rfidHealth?.status === "ok" ||
    rfidHealth?.service === "smartlib-rfid-middleware" ||
    typeof rfidHealth?.devices_online === "number");

// When backend is down, RFID middleware buffers events to SQLite
const rfidBackendConnected = rfidHealth?.backend_connected ?? true;
const rfidBufferedMode = rfidOnline && !rfidBackendConnected;
```

Rendered in the header:
```tsx
<ConnectionIndicator
  label="RFID Middleware"
  online={rfidOnline}
  subLabel={rfidBufferedMode ? "Offline Buffer Active" : undefined}
/>
```

### 2.4 Vite Dev Server Proxy (`frontend/vite.config.ts`)
Added `/rfid` proxy route targeting `http://127.0.0.1:8000`:
```typescript
proxy: {
  "/api": {
    target: "http://localhost:5000",
    changeOrigin: true,
  },
  "/rfid": {
    target: "http://127.0.0.1:8000",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/rfid/, ""),
  },
}
```

---

## 3. End-to-End Verification Test Suite

A dedicated Playwright integration test suite (`frontend/e2e/rfid-connection.spec.ts`) was executed against the live application:

| Test Case | Scenario Verified | Result | Execution Time |
| :--- | :--- | :---: | :---: |
| **1. Online Detection** | Probes `http://localhost:8000/health` with live nominal payload; confirms badge displays `Online` with green indicator. | **PASSED** | 8.4s |
| **2. Backend Outage Handling** | Express backend `/health` aborts; RFID returns `backend_connected: false`; confirms `Backend API: Offline` while `RFID Middleware: Online (Offline Buffer Active)` remains visible without timing out. | **PASSED** | 6.5s |
| **3. Automatic Reconnection** | RFID health check is cut (service down); badge transitions to `Offline`. Service is restored; badge automatically reconnects to `Online`. | **PASSED** | 24.0s |
| **4. Host Resolution Fallback** | `http://localhost:8000/health` connection refused (simulating Windows IPv6 `::1` refusal); client automatically falls back to `127.0.0.1:8000` and displays `Online`. | **PASSED** | 8.1s |

**Suite Total**: `4 passed (1.0m)`

### Regression Verification (`dashboard-connection.spec.ts`)
Run command: `npx --prefix frontend playwright test e2e/dashboard-connection.spec.ts`
- **Result**: `1 passed (23.3s)`
- Confirms both `Backend API: Online` and `RFID Middleware: Online` simultaneously render nominal, alongside live Neon database KPI metrics (`1 Book`, `1 Member`, `1 Loan`, `2 Tagged Copies`).

### Production Build
Run command: `npm --prefix frontend run build`
- **Result**: Vite TypeScript compilation completed with **0 errors**.

---

## 4. Preservation of Existing Services

As required:
- **RFID drivers (`mock_drivers.py`, etc.)**: **Unmodified**.
- **SQLite buffer (`buffer.py`, etc.)**: **Unmodified**.
- **Express backend (`backend/src/`...)**: **Unmodified**.
All changes were strictly contained within the frontend client, proxy routing, and health detection logic.

