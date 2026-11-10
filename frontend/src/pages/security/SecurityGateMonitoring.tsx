import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, AlertOctagon, RefreshCw, Radio, Camera, Volume2, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { rfidGet, rfidPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { SecurityGateEventRequest } from "@/types";

interface GateEvent {
  event_id: string;
  timestamp: string;
  device_id: string;
  epc: string;
  is_authorized: boolean;
  alarm_triggered: boolean;
  cctv_ref?: string;
  status: string;
}

export default function SecurityGateMonitoringPage() {
  const queryClient = useQueryClient();
  const [testEpc, setTestEpc] = useState("E28011606000020000000002");
  const [direction, setDirection] = useState<"in" | "out">("out");

  // Query events from Python FastAPI RFID middleware
  const { data: eventsData, isLoading, refetch } = useQuery({
    queryKey: ["rfid", "security-events"],
    queryFn: () => rfidGet<{ events: GateEvent[]; total: number }>("/events"),
    refetchInterval: 5000,
  });

  // Simulate gate transit event
  const gateMutation = useMutation({
    mutationFn: (req: SecurityGateEventRequest) =>
      rfidPost<{ status: string; alarm_triggered: boolean }>("/devices/security-gate/event", req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfid", "security-events"] });
    },
  });

  const handleSimulatePassage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEpc.trim()) return;
    gateMutation.mutate({
      device_id: "security_gate_main_01",
      epc_codes: [testEpc.trim()],
      direction,
    });
  };

  const events = eventsData?.events ?? [];

  return (
    <div>
      <PageHeader
        title="Security Gate Telemetry & EAS Monitor"
        description="Physical perimeter surveillance, EAS anti-theft alarms, and pedestrian gate tracking"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Security Gate" }]}
        actions={
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-success animate-ping" />
            <Badge variant="outline" className="text-xs">Gate Sensor Online</Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Gate Simulation Controller */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="size-4 text-destructive" />
              Simulate Gate Passage
            </CardTitle>
            <CardDescription>
              Test anti-theft gate pedestals with an issued or unissued tag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSimulatePassage} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Tag EPC Code</label>
                <Input
                  className="font-mono text-xs"
                  value={testEpc}
                  onChange={(e) => setTestEpc(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Transit Direction</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={direction === "out" ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setDirection("out")}
                  >
                    Exiting Library (Out)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={direction === "in" ? "default" : "outline"}
                    className="flex-1 text-xs"
                    onClick={() => setDirection("in")}
                  >
                    Entering Library (In)
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={gateMutation.isPending || !testEpc}
                className="w-full bg-destructive hover:bg-destructive/90 text-white"
              >
                {gateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Simulate Gate Crossing"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Live Gate Status Overview */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Security Perimeter Status</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
                <RefreshCw className="size-3" />
                Poll
              </Button>
            </CardTitle>
            <CardDescription>Main Gate Pedestals A & B (AFI EAS Verification Active)</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3 text-xs">
            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-foreground font-semibold mb-1">
                <Volume2 className="size-4 text-destructive" />
                Acoustic Siren & Flasher
              </div>
              <p className="text-muted-foreground">Triggered on detection of unauthorized EPC where EAS bit != DISARMED.</p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-foreground font-semibold mb-1">
                <Camera className="size-4 text-primary" />
                CCTV Frame Snapshot
              </div>
              <p className="text-muted-foreground">Hardware trigger automatically freezes high-resolution turnstile camera footage.</p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/20">
              <div className="flex items-center gap-2 text-foreground font-semibold mb-1">
                <ShieldCheck className="size-4 text-success" />
                Offline Event Resiliency
              </div>
              <p className="text-muted-foreground">Local SQLite buffer preserves tamper-proof logs even during network disconnects.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Transit Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Real-Time Security Event Log</CardTitle>
          <CardDescription>Live telemetry from physical gate antenna transceivers</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap pl-5">Event ID</TableHead>
                  <TableHead className="whitespace-nowrap">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap">Pedestal Device</TableHead>
                  <TableHead className="whitespace-nowrap">Detected EPC</TableHead>
                  <TableHead className="whitespace-nowrap">Security State</TableHead>
                  <TableHead className="whitespace-nowrap">CCTV Snapshot</TableHead>
                  <TableHead className="whitespace-nowrap pr-5">Sync Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7} className="h-10 animate-pulse bg-muted/40" />
                    </TableRow>
                  ))
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm py-6 text-muted-foreground">
                      No gate transit events recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((evt) => (
                    <TableRow key={evt.event_id} className={evt.alarm_triggered ? "bg-destructive/5" : undefined}>
                      <TableCell className="identifier text-xs whitespace-nowrap pl-5">{evt.event_id.slice(0, 8)}…</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(evt.timestamp)}</TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{evt.device_id}</TableCell>
                      <TableCell className="identifier text-xs font-semibold whitespace-nowrap">{evt.epc}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {evt.alarm_triggered ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <AlertOctagon className="size-3" />
                            UNAUTHORIZED EXIT
                          </Badge>
                        ) : (
                          <Badge variant="success" className="flex items-center gap-1 w-fit">
                            <ShieldCheck className="size-3" />
                            CLEARED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                        {evt.cctv_ref ?? "CAM_01_FRAME_OK"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-5">
                        <Badge variant="outline" className="text-[10px]">{evt.status.toUpperCase()}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

