import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PackageSearch, ScanLine, AlertCircle, CheckCircle2, MapPin, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { rfidPost } from "@/lib/api";
import type { HandheldScanRequest } from "@/types";

interface HandheldResponse {
  device_id: string;
  shelf_location: string;
  total_scanned: number;
  matched_count: number;
  missing_count: number;
  misplaced_count: number;
  misplaced_items: Array<{ epc: string; accession: string; expected_shelf: string }>;
  timestamp: string;
}

export default function InventoryManagementPage() {
  const [shelfLocation, setShelfLocation] = useState("SHELF-CS-04");
  const [epcList, setEpcList] = useState("E28011606000020000000001\nE28011606000020000000002");
  const [scanResult, setScanResult] = useState<HandheldResponse | null>(null);

  const inventoryMutation = useMutation({
    mutationFn: (req: HandheldScanRequest) =>
      rfidPost<HandheldResponse>("/devices/handheld/scan", req),
    onSuccess: (data) => {
      setScanResult(data);
    },
  });

  const handleAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const codes = epcList
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (codes.length === 0) return;

    inventoryMutation.mutate({
      device_id: "handheld_reader_mobile_01",
      shelf_location: shelfLocation,
      epc_codes: codes,
    });
  };

  return (
    <div>
      <PageHeader
        title="Inventory & Shelf Audit"
        description="Rapid handheld RFID mobile scanner sweep for shelf verification and misplaced book discovery"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Inventory" }]}
      />

      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Handheld Scanner Input */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="size-4 text-rfid" />
              Handheld Wand Scanner Sweep
            </CardTitle>
            <CardDescription>
              Simulate bulk RFID tags read along a bookshelf row
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAudit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Target Shelf Identifier</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    className="pl-8 font-mono text-xs"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium">Scanned EPCs (one per line)</label>
                <textarea
                  rows={4}
                  className="rounded-md border border-input bg-background p-2 text-xs font-mono"
                  value={epcList}
                  onChange={(e) => setEpcList(e.target.value)}
                />
              </div>

              <Button
                type="submit"
                disabled={inventoryMutation.isPending}
                className="bg-rfid hover:bg-rfid/90 text-white w-full"
              >
                {inventoryMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Auditing Shelf Tags...
                  </>
                ) : (
                  "Execute Shelf Audit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Audit Metrics */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Detected</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">
                {scanResult ? scanResult.total_scanned : "—"}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Matched On Shelf</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-success">
                {scanResult ? scanResult.matched_count : "—"}
              </p>
            </Card>

            <Card className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Misplaced / Foreign</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-destructive">
                {scanResult ? scanResult.misplaced_count : "—"}
              </p>
            </Card>
          </div>

          <Card className="flex-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shelf Discrepancy Analysis</CardTitle>
              <CardDescription>Items physically detected on this shelf that belong elsewhere</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {!scanResult ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Run a handheld reader sweep on any shelf location to inspect discrepancies.
                </div>
              ) : scanResult.misplaced_items.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center gap-2">
                  <CheckCircle2 className="size-8 text-success" />
                  <p className="text-sm font-medium">Shelf is 100% verified!</p>
                  <p className="text-xs text-muted-foreground">No misplaced or foreign items were detected.</p>
                </div>
              ) : (
                <div className="w-full max-w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap pl-5">Detected Tag EPC</TableHead>
                        <TableHead className="whitespace-nowrap">Accession</TableHead>
                        <TableHead className="whitespace-nowrap">Expected Shelf Location</TableHead>
                        <TableHead className="whitespace-nowrap pr-5">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scanResult.misplaced_items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="identifier text-xs whitespace-nowrap pl-5">{item.epc}</TableCell>
                          <TableCell className="font-medium text-xs whitespace-nowrap">{item.accession}</TableCell>
                          <TableCell className="text-xs text-destructive font-mono font-medium whitespace-nowrap">
                            {item.expected_shelf}
                          </TableCell>
                          <TableCell className="whitespace-nowrap pr-5">
                            <Badge variant="outline" className="text-[10px]">Relocate Item</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

