import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Tag, RefreshCw, CheckCircle2, AlertCircle, Radio, Link as LinkIcon, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { rfidPost, apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { PaginatedResponse, RFIDTag, StaffStationScanRequest } from "@/types";

interface ScanResponse {
  device_id: string;
  timestamp: string;
  processed_tags: Array<{
    epc: string;
    identified: boolean;
    accession_number?: string;
    title?: string;
    status: string;
  }>;
  total_scanned: number;
  duplicate_count: number;
}

export default function RFIDTaggingPage() {
  const [epcInput, setEpcInput] = useState("E28011606000020000000001");
  const [deviceId] = useState("staff_station_circ_01");
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null);

  // Load existing RFID tags from backend
  const { data: tagsData, isLoading: tagsLoading, refetch: refetchTags } = useQuery({
    queryKey: ["rfid", "tags"],
    queryFn: () => apiGet<PaginatedResponse<RFIDTag>>("/rfid/tags", { limit: 10 }),
    staleTime: 30_000,
  });

  // Scan simulation mutation to Python FastAPI RFID Middleware
  const scanMutation = useMutation({
    mutationFn: (req: StaffStationScanRequest) =>
      rfidPost<ScanResponse>("/devices/staff-station/scan", req),
    onSuccess: (data) => {
      setScanResult(data);
      refetchTags();
    },
  });

  const handleSimulateScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!epcInput.trim()) return;
    scanMutation.mutate({
      device_id: deviceId,
      epc_codes: [epcInput.trim()],
    });
  };

  return (
    <div>
      <PageHeader
        title="RFID Tagging & Encoding Station"
        description="Physical transponder programming, verification, and accession binding"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "RFID Tagging" }]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="rfid-muted" className="px-3 py-1 font-mono text-xs">
              Station: {deviceId}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Hardware Reader Scanner Simulation */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="size-4 text-rfid animate-pulse" />
              Staff RFID Flatbed Reader
            </CardTitle>
            <CardDescription>
              Scan high-frequency tag placed on workstation pad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSimulateScan} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Tag EPC Hex String</label>
                <Input
                  className="font-mono text-xs"
                  placeholder="e.g. E2801160..."
                  value={epcInput}
                  onChange={(e) => setEpcInput(e.target.value)}
                  disabled={scanMutation.isPending}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => setEpcInput("E2801160" + Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString(16).toUpperCase())}
                >
                  Generate Random EPC
                </Button>
                <Button
                  type="submit"
                  disabled={scanMutation.isPending || !epcInput}
                  className="bg-rfid hover:bg-rfid/90 text-white text-xs"
                >
                  {scanMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Trigger Read"
                  )}
                </Button>
              </div>
            </form>

            {/* Scan outcome report */}
            {scanResult && (
              <div className="mt-4 rounded-lg border p-3 bg-muted/30 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">Reader Response</span>
                  <Badge variant="outline" className="text-[10px]">{scanResult.timestamp.slice(11, 19)}</Badge>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scanned Tags:</span>
                    <span className="font-semibold tabular-nums">{scanResult.total_scanned}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duplicate Filtered:</span>
                    <span className="font-semibold tabular-nums">{scanResult.duplicate_count}</span>
                  </div>

                  {scanResult.processed_tags.map((t, idx) => (
                    <div key={idx} className="mt-2 rounded border bg-card p-2 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="identifier font-medium">{t.epc}</span>
                        {t.identified ? (
                          <Badge variant="success" className="text-[10px] h-4">Known Copy</Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px] h-4">New / Unlinked</Badge>
                        )}
                      </div>
                      {t.accession_number && (
                        <p className="mt-1 text-muted-foreground">
                          Accession: <span className="font-medium text-foreground">{t.accession_number}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Association / Linker Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <LinkIcon className="size-4 text-primary" />
              Bind RFID Transponder to Accession Record
            </CardTitle>
            <CardDescription>
              Program transponder user memory block with security EAS bit set to ARMED
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Accession Number</label>
                <Input placeholder="e.g. ACC-2026-00001" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">RFID Transponder Standard</label>
                <Input value="ISO 15693 (HF 13.56 MHz / SLIX2)" disabled className="bg-muted text-muted-foreground" />
              </div>
            </div>

            <div className="rounded-md border p-3 bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Security Bit (EAS / AFI)</p>
                <p className="text-[11px]">ARMED state triggers gate alarms automatically unless disarmed by circulation desk.</p>
              </div>
              <Badge variant="rfid" className="px-2.5 py-1">EAS ARMED</Badge>
            </div>

            <Button disabled className="w-full sm:w-auto self-start" title="Awaiting POST /api/v1/rfid/bind">
              <Tag className="size-4" />
              Encode Tag & Associate Item
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Programmed Tags Register */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Registered RFID Transponders</CardTitle>
            <CardDescription>Tags synced from the database repository</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchTags()} disabled={tagsLoading}>
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap pl-5">Tag EPC</TableHead>
                  <TableHead className="whitespace-nowrap">Standard</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Linked Book Copy</TableHead>
                  <TableHead className="whitespace-nowrap">Last Read At</TableHead>
                  <TableHead className="whitespace-nowrap pr-5">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tagsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-10 animate-pulse bg-muted/40" />
                    </TableRow>
                  ))
                ) : tagsData?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm py-6 text-muted-foreground">
                      No RFID tags registered in system yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tagsData?.data?.map((tag) => (
                    <TableRow key={tag.id}>
                      <TableCell className="identifier text-xs font-semibold whitespace-nowrap pl-5">{tag.epc}</TableCell>
                      <TableCell className="whitespace-nowrap"><Badge variant="outline" className="text-[11px]">{tag.tagType}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant={tag.status === "ACTIVE" ? "success" : "secondary"}>
                          {tag.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="identifier text-xs text-muted-foreground whitespace-nowrap">
                        {tag.bookCopyId ? tag.bookCopyId.slice(0, 14) + "…" : "Unlinked"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {tag.lastSeenAt ? formatDateTime(tag.lastSeenAt) : "Never"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap pr-5">
                        {formatDateTime(tag.createdAt)}
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

