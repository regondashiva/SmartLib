import { Lock, ShieldCheck, Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

export default function RolesPermissionsPage() {
  const permissions = [
    { module: "Dashboard & Analytics", admin: true, librarian: true, staff: true, viewer: true },
    { module: "Catalog View & Search", admin: true, librarian: true, staff: true, viewer: true },
    { module: "Cataloguing & Ingestion", admin: true, librarian: true, staff: false, viewer: false },
    { module: "Member Management", admin: true, librarian: true, staff: true, viewer: false },
    { module: "Circulation Check-Out / Return", admin: true, librarian: true, staff: true, viewer: false },
    { module: "RFID Tag Encoding & Binding", admin: true, librarian: true, staff: true, viewer: false },
    { module: "Handheld Inventory Sweep", admin: true, librarian: true, staff: true, viewer: false },
    { module: "Security Gate Telemetry & Alarms", admin: true, librarian: true, staff: true, viewer: false },
    { module: "Data Migration & Batch Import", admin: true, librarian: true, staff: false, viewer: false },
    { module: "User & Role Administration", admin: true, librarian: false, staff: false, viewer: false },
    { module: "Audit Log Inspection", admin: true, librarian: false, staff: false, viewer: false },
    { module: "Database Backup & Offline Engine", admin: true, librarian: false, staff: false, viewer: false },
  ];

  return (
    <div>
      <PageHeader
        title="Roles & Access Control (RBAC)"
        description="Fine-grained permission matrices, privileges, and privilege escalation guards"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Roles & Permissions" }]}
      />

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              RBAC Matrix
            </CardTitle>
            <CardDescription>System access permissions mapped against institutional roles</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">Immutable System Roles</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Functional Domain / Route</TableHead>
                <TableHead className="text-center font-semibold text-primary">ADMIN</TableHead>
                <TableHead className="text-center font-semibold">LIBRARIAN</TableHead>
                <TableHead className="text-center font-semibold">STAFF</TableHead>
                <TableHead className="text-center font-semibold text-muted-foreground">VIEWER</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-xs">{p.module}</TableCell>
                  <TableCell className="text-center">
                    {p.admin ? <Check className="size-4 text-success mx-auto" /> : <X className="size-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.librarian ? <Check className="size-4 text-success mx-auto" /> : <X className="size-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.staff ? <Check className="size-4 text-success mx-auto" /> : <X className="size-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.viewer ? <Check className="size-4 text-success mx-auto" /> : <X className="size-4 text-muted-foreground mx-auto" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

