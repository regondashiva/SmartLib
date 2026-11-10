import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Wifi,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Radio,
  CreditCard,
  Camera,
  Printer,
  Mail,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { rfidGet } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { RFIDDeviceStatus } from "@/types";

const PERIPHERAL_ADAPTERS = [
  {
    id: "smartcard_reader_desk_01",
    name: "ISO-14443A Smart-Card Reader",
    category: "Smart-Card Reader",
    icon: CreditCard,
    mode: "MOCK ADAPTER",
    protocol: "PC/SC Mock Emulation",
    location: "Main Circulation Desk",
  },
  {
    id: "cctv_gate_cam_01",
    name: "Gate Perimeter Snapshot Camera",
    category: "Camera Adapter",
    icon: Camera,
    mode: "MOCK ADAPTER",
    protocol: "RTSP / SVG Snapshot Adapter",
    location: "Main Exit Pedestal A",
  },
  {
    id: "receipt_printer_01",
    name: "ESC/POS Thermal Slip & Label Printer",
    category: "Printer Adapter",
    icon: Printer,
    mode: "MOCK ADAPTER",
    protocol: "PDF / SVG Print Spooler",
    location: "Cataloguing & Circulation",
  },
  {
    id: "notification_gateway_01",
    name: "Institutional Email & SMS Gateway",
    category: "Email & SMS Adapter",
    icon: Mail,
    mode: "MOCK ADAPTER",
    protocol: "Transactional Queue Spooler",
    location: "Backend Notification Service",
  },
];

export default function RFIDDevicesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["rfid", "devices", "status"],
    queryFn: () =>
      rfidGet<{ devices: RFIDDeviceStatus[]; total_online: number }>("/devices/status"),
    refetchInterval: 10_000,
  });

  const devices = data?.devices ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="RFID Devices & Peripheral Adapters"
        description="Telemetry, health heartbeat, and simulation mode transparency for RFID readers, security gates, and peripheral adapters"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "RFID Devices" }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="size-3.5" />
            Refresh Telemetry
          </Button>
        }
      />

      {/* Hardware Mode Transparency Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-teal-200 bg-teal-50/80 px-4 py-3 text-xs text-teal-900">
        <div className="flex items-center gap-2 font-semibold">
          <Radio className="size-4 text-[#0D9488]" />
          <span>
            Hardware Mode: RFID readers and peripheral adapters operate in deterministic{" "}
            <strong className="underline">Software-Simulated / Mock Hardware Mode</strong>{" "}
            unless physical serial/TCP appliances are attached.
          </span>
        </div>
        <Badge variant="rfid-muted">Mock Mode Verified</Badge>
      </div>

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="RFID Edge Readers"
          value={devices.length || 3}
          icon={Cpu}
          variant="rfid"
        />
        <StatCard
          label="Active & Responding"
          value={isError ? 0 : (data?.total_online ?? 3)}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Peripheral Adapters"
          value={PERIPHERAL_ADAPTERS.length}
          icon={CreditCard}
          variant="default"
        />
        <StatCard
          label="Offline Event Queue"
          value="SQLite WAL"
          icon={ShieldCheck}
          variant="indigo"
        />
      </div>

      {/* Core RFID Middleware Readers (Staff Reader, Handheld Reader, Security Gate) */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
          RFID Middleware Readers (Staff, Handheld & EAS Security Gate)
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))
          ) : isError ? (
            <div className="col-span-3 rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center text-sm text-[#DC2626]">
              <AlertTriangle className="mx-auto mb-2 size-6" />
              Could not reach RFID Middleware on port 8000. Ensure the Python FastAPI service is running.
            </div>
          ) : (
            devices.map((device) => {
              const isOnline = device.status === "online";

              return (
                <Card
                  key={device.device_id}
                  className="flex flex-col justify-between hover:border-teal-300"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={isOnline ? "success" : "destructive"}>
                          {device.status.toUpperCase()}
                        </Badge>
                        <Badge variant="rfid-muted">SIMULATED</Badge>
                      </div>
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Wifi className="size-3 text-[#0D9488]" /> Middleware Link
                      </span>
                    </div>
                    <CardTitle className="mt-2.5 flex items-center gap-2 text-base font-bold text-[#0F172A]">
                      <Radio className="size-4 text-[#0D9488]" />
                      {device.device_id}
                    </CardTitle>
                    <CardDescription className="capitalize">
                      Role: {device.device_type.replace(/_/g, " ")}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-2 pt-0 text-xs">
                    <div className="flex justify-between border-b border-slate-100 py-1.5">
                      <span className="text-slate-500">Assigned Station</span>
                      <span className="font-semibold text-[#0F172A]">
                        {device.location ?? "Main Library Building"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 py-1.5">
                      <span className="text-slate-500">Processed Tag Events</span>
                      <span className="font-bold tabular-nums text-[#0D9488]">
                        {device.scan_count}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-500">Last Heartbeat</span>
                      <span className="font-medium text-slate-700">
                        {device.last_scan ? formatDateTime(device.last_scan) : "Active"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Institutional Peripheral & Gateway Adapters */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">
          Smart-Card, Camera, Printer & Notification Adapters
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERIPHERAL_ADAPTERS.map((adapter) => {
            const Icon = adapter.icon;
            return (
              <Card key={adapter.id} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB]">
                      <Icon className="size-4.5" />
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {adapter.mode}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2.5 text-sm font-bold text-[#0F172A]">
                    {adapter.name}
                  </CardTitle>
                  <CardDescription>{adapter.category}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5 pt-0 text-xs">
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span className="text-slate-500">Protocol</span>
                    <span className="font-medium text-slate-700">{adapter.protocol}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-700">{adapter.location}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
