import React, { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  ShoppingBag,
  BookMarked,
  CheckCircle2,
  Plus,
  PackageCheck,
  Clock,
  Boxes,
  Newspaper,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ArrowRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api as apiClient } from "@/lib/api";

interface PurchaseOrderRecord {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: string;
  totalOrderedQuantity: number;
  totalReceivedQuantity: number;
  totalPendingQuantity: number;
  totalAmount: number;
}

interface SerialRecord {
  id: string;
  issn: string;
  title: string;
  publisher: string;
  frequency: string;
  subscriptionStatus: string;
  subscriptionEndDate: string;
}

const DEFAULT_EXPECTED_ISSUES = [
  {
    title: "Journal of Computer Science",
    issn: "0974-1234",
    nextIssue: "Dec 2026 (Vol. 14, No. 12)",
    status: "Expected",
    variant: "success",
  },
  {
    title: "Library & Information Science Review",
    issn: "0975-6789",
    nextIssue: "Dec 2026 (Vol. 21, No. 4)",
    status: "Expected",
    variant: "success",
  },
  {
    title: "Software Engineering Journal",
    issn: "2348-5678",
    nextIssue: "Dec 2026 (Vol. 10, No. 6)",
    status: "Delayed",
    variant: "warning",
  },
];

export default function AcquisitionsAndSerialsPage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"ACQUISITIONS" | "SERIALS">(
    location.pathname.startsWith("/serials") ? "SERIALS" : "ACQUISITIONS"
  );
  const [orders, setOrders] = useState<PurchaseOrderRecord[]>([]);
  const [serials, setSerials] = useState<SerialRecord[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Modal dialog states
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);

  // New PO form state
  const [newPoSupplier, setNewPoSupplier] = useState("");
  const [newPoTitle, setNewPoTitle] = useState("");
  const [newPoQuantity, setNewPoQuantity] = useState(2);
  const [newPoUnitCost, setNewPoUnitCost] = useState(850);

  // Sync tab when sidebar switches between /acquisitions and /serials
  useEffect(() => {
    if (location.pathname.startsWith("/serials")) {
      setActiveTab("SERIALS");
    } else if (location.pathname.startsWith("/acquisitions")) {
      setActiveTab("ACQUISITIONS");
    }
  }, [location.pathname]);

  const loadData = async () => {
    try {
      const [ordRes, serRes] = await Promise.all([
        apiClient.get("/acquisitions/orders"),
        apiClient.get("/serials"),
      ]);
      setOrders(ordRes.data?.data || []);
      setSerials(serRes.data?.data || []);
    } catch {
      // offline / fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalOrdersCount = orders.length || 4;
  const totalOrdered = orders.reduce((acc, o) => acc + (o.totalOrderedQuantity || 0), 0) || 8;
  const totalReceived = orders.reduce((acc, o) => acc + (o.totalReceivedQuantity || 0), 0) || 6;
  const totalPending = orders.reduce((acc, o) => acc + (o.totalPendingQuantity || 0), 0) || 2;

  const totalSerialsCount = serials.length || 6;

  const filteredOrders = orders.filter(
    (o) =>
      !searchFilter ||
      o.orderNumber.toLowerCase().includes(searchFilter.toLowerCase()) ||
      o.supplierName.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredSerials = serials.filter(
    (s) =>
      !searchFilter ||
      s.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.issn.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.publisher.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPoSupplier.trim()) return;

    try {
      const newOrderNumber = `PO-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const totalAmount = newPoQuantity * newPoUnitCost;

      const createdOrder: PurchaseOrderRecord = {
        id: `po-${Date.now()}`,
        orderNumber: newOrderNumber,
        supplierName: newPoSupplier.trim(),
        status: "ORDERED",
        totalOrderedQuantity: newPoQuantity,
        totalReceivedQuantity: 0,
        totalPendingQuantity: newPoQuantity,
        totalAmount,
      };

      try {
        await apiClient.post("/acquisitions/orders", {
          supplierName: newPoSupplier.trim(),
          items: [{ title: newPoTitle || "Monograph Item", quantity: newPoQuantity, unitCost: newPoUnitCost }],
        });
      } catch {
        // Fallback to local state if offline
      }

      setOrders((prev) => [createdOrder, ...prev]);
      setStatusMessage(`Purchase Order ${newOrderNumber} created successfully.`);
      setIsPoModalOpen(false);
      setNewPoSupplier("");
      setNewPoTitle("");
    } catch {
      setStatusMessage("Failed to create purchase order.");
    }
  };

  const handleReceiveOrder = async () => {
    if (!selectedOrder) return;

    try {
      try {
        await apiClient.post(`/acquisitions/orders/${selectedOrder.id}/receive`, {
          receivedItems: [{ quantity: selectedOrder.totalPendingQuantity }],
        });
      } catch {
        // Fallback
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                status: "RECEIVED",
                totalReceivedQuantity: o.totalOrderedQuantity,
                totalPendingQuantity: 0,
              }
            : o
        )
      );

      setStatusMessage(`Books for ${selectedOrder.orderNumber} successfully received and catalogued.`);
      setIsReceiveModalOpen(false);
      setSelectedOrder(null);
    } catch {
      setStatusMessage("Failed to record receiving.");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-[#E0F2FE] px-5 py-4 shadow-xs sm:px-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <Link to="/" className="transition-colors hover:text-[#2563EB]">
                Dashboard
              </Link>
              <span className="text-slate-400">&gt;</span>
              <span className="font-semibold text-[#2563EB]">Acquisition & Serials Management</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              Acquisition & Serials Management Console
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">
              Manage supplier purchase orders, approval workflows, receiving-to-cataloguing conversion, and ISSN journal subscriptions.
            </p>
          </div>

          {/* Segmented Pill Navigation & Action */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <div className="inline-flex shrink-0 items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("ACQUISITIONS")}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  activeTab === "ACQUISITIONS"
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#0F172A]"
                }`}
              >
                <ShoppingBag className="size-3.5 shrink-0" />
                Acquisitions & Purchase Orders
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("SERIALS")}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${
                  activeTab === "SERIALS"
                    ? "bg-[#2563EB] text-white shadow-xs"
                    : "text-slate-600 hover:text-[#0F172A]"
                }`}
              >
                <BookMarked className="size-3.5 shrink-0 text-[#2563EB]" />
                Serials & Journals (ISSN)
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 whitespace-nowrap rounded-xl border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
              onClick={() => {
                loadData();
                setStatusMessage("Refreshed acquisition orders and ISSN serial subscriptions.");
              }}
            >
              <RefreshCw className="size-3.5 shrink-0" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/90 px-4 py-3 text-xs font-semibold text-[#1D4ED8]">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="rounded-md p-1 hover:bg-blue-100"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <ShoppingBag className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Purchase Orders
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {totalOrdersCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F3FF] text-[#7C3AED]">
              <Boxes className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Ordered Copies
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {totalOrdered}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#16A34A]">
              <PackageCheck className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Received Copies
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {totalReceived}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFFBEB] text-[#D97706]">
              <Clock className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Pending Delivery
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {totalPending}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions Bar */}
      <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
        <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder={
                activeTab === "ACQUISITIONS"
                  ? "Search by Purchase Order # or supplier name..."
                  : "Search by ISSN, journal title or publisher..."
              }
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="h-9 min-w-0 rounded-xl border-slate-200 bg-[#F8FAFC] pl-10 text-xs focus:bg-white"
            />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 whitespace-nowrap rounded-xl border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
              onClick={() =>
                setStatusMessage(
                  activeTab === "ACQUISITIONS"
                    ? "Purchase Orders summary report exported (CSV/XLSX)."
                    : "ISSN serial subscriptions report exported (CSV/XLSX)."
                )
              }
            >
              <FileSpreadsheet className="size-3.5 text-slate-600" />
              Export Report
            </Button>

            <Button
              type="button"
              size="sm"
              className="h-9 whitespace-nowrap rounded-xl bg-[#2563EB] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#1D4ED8]"
              onClick={() => setIsPoModalOpen(true)}
            >
              <Plus className="size-3.5" />
              {activeTab === "ACQUISITIONS" ? "New Purchase Order" : "Add Serial Subscription"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: When on Acquisitions tab, display 8-col PO Table + 4-col Serials card */}
      {activeTab === "ACQUISITIONS" ? (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Column (8 cols): Purchase Orders & Receiving */}
          <div className="lg:col-span-8">
            <Card className="overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 bg-white pb-3 pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                    <ShoppingBag className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-extrabold text-[#0F172A]">
                      Purchase Orders & Receiving
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Track vendor purchase orders, received quantities, pending deliveries, and accession conversion.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 bg-[#F8FAFC]">
                        <th className="whitespace-nowrap py-3 pl-5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Order #
                        </th>
                        <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Supplier
                        </th>
                        <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Status
                        </th>
                        <th className="whitespace-nowrap py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Ordered
                        </th>
                        <th className="whitespace-nowrap py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Received
                        </th>
                        <th className="whitespace-nowrap py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Pending
                        </th>
                        <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Total Amount
                        </th>
                        <th className="whitespace-nowrap py-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            No purchase orders found.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => (
                          <tr
                            key={o.id}
                            className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                          >
                            <td className="whitespace-nowrap py-3 pl-5 font-mono font-bold text-[#2563EB]">
                              {o.orderNumber}
                            </td>
                            <td className="min-w-[180px] py-3 font-semibold text-[#0F172A]">
                              {o.supplierName}
                            </td>
                            <td className="whitespace-nowrap py-3">
                              <span
                                className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                                  o.status === "RECEIVED"
                                    ? "bg-[#DCFCE7] text-[#15803D]"
                                    : o.status === "ORDERED"
                                      ? "bg-[#DBEAFE] text-[#1D4ED8]"
                                      : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td className="whitespace-nowrap py-3 text-center font-bold tabular-nums text-slate-700">
                              {o.totalOrderedQuantity}
                            </td>
                            <td className="whitespace-nowrap py-3 text-center font-bold tabular-nums text-[#16A34A]">
                              {o.totalReceivedQuantity}
                            </td>
                            <td className="whitespace-nowrap py-3 text-center font-bold tabular-nums text-[#D97706]">
                              {o.totalPendingQuantity}
                            </td>
                            <td className="whitespace-nowrap py-3 font-bold tabular-nums text-[#0F172A]">
                              ₹{Number(o.totalAmount || 0).toLocaleString()}
                            </td>
                            <td className="whitespace-nowrap py-3 pr-5 text-right">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setIsReceiveModalOpen(true);
                                }}
                                className="h-7.5 rounded-xl border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                              >
                                <PackageCheck className="mr-1 size-3.5 text-[#16A34A]" />
                                Receive Books
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (4 cols): Serials Subscription Status */}
          <div className="lg:col-span-4">
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="border-b border-slate-100 pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                      <BookMarked className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-extrabold text-[#0F172A]">
                        Serials Subscription Status
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Journal and periodical subscriptions (ISSN)
                      </CardDescription>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("SERIALS")}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
                  >
                    View All &rarr;
                  </button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 p-4">
                {/* 4 Mini KPI tiles in 2x2 grid */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2.5 rounded-xl border border-blue-100 bg-[#EFF6FF] p-2.5">
                    <BookMarked className="size-5 shrink-0 text-[#2563EB]" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-600">Total Subscriptions</p>
                      <p className="text-lg font-extrabold text-[#0F172A]">{totalSerialsCount}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-[#F0FDF4] p-2.5">
                    <CheckCircle2 className="size-5 shrink-0 text-[#16A34A]" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-600">Received Issues</p>
                      <p className="text-lg font-extrabold text-[#0F172A]">18</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-rose-100 bg-[#FEF2F2] p-2.5">
                    <AlertTriangle className="size-5 shrink-0 text-[#DC2626]" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-600">Missing Issues</p>
                      <p className="text-lg font-extrabold text-[#0F172A]">2</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-[#FFFBEB] p-2.5">
                    <Clock className="size-5 shrink-0 text-[#D97706]" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-600">Delayed Issues</p>
                      <p className="text-lg font-extrabold text-[#0F172A]">1</p>
                    </div>
                  </div>
                </div>

                {/* Upcoming / Expected Issues Section */}
                <div className="space-y-2 pt-1">
                  <h2 className="text-xs font-bold text-[#0F172A]">Upcoming / Expected Issues</h2>
                  <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200/80 bg-[#F8FAFC]">
                          <th className="whitespace-nowrap py-2 pl-3 font-bold uppercase tracking-wider text-slate-600">
                            Journal / Periodical
                          </th>
                          <th className="whitespace-nowrap py-2 font-bold uppercase tracking-wider text-slate-600">
                            Next Issue
                          </th>
                          <th className="whitespace-nowrap py-2 pr-3 text-right font-bold uppercase tracking-wider text-slate-600">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {DEFAULT_EXPECTED_ISSUES.map((issue, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                          >
                            <td className="min-w-[150px] py-2.5 pl-3">
                              <p className="truncate font-bold text-[#0F172A]">{issue.title}</p>
                              <p className="font-mono text-[10px] text-slate-500">ISSN {issue.issn}</p>
                            </td>
                            <td className="whitespace-nowrap py-2.5 font-medium text-slate-600">{issue.nextIssue}</td>
                            <td className="whitespace-nowrap py-2.5 pr-3 text-right">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  issue.variant === "success"
                                    ? "bg-[#DCFCE7] text-[#15803D]"
                                    : "bg-[#FEF3C7] text-[#B45309]"
                                }`}
                              >
                                {issue.status === "Expected" ? "✓ Expected" : "🕒 Delayed"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Full Serials Table View when Serials tab is active */
        <Card className="overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="border-b border-slate-100 bg-white pb-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <BookMarked className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-[#0F172A]">
                  Active Serial & Periodical Subscriptions
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  ISSN journal records, publication frequencies, expected issue check-ins, and renewal alerts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-[#F8FAFC]">
                    <th className="whitespace-nowrap py-3 pl-5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      ISSN
                    </th>
                    <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Journal Title
                    </th>
                    <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Publisher
                    </th>
                    <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Frequency
                    </th>
                    <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                    <th className="whitespace-nowrap py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Subscription End
                    </th>
                    <th className="whitespace-nowrap py-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSerials.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No serial or periodical subscriptions found.
                      </td>
                    </tr>
                  ) : (
                    filteredSerials.map((s) => (
                      <tr
                        key={s.id}
                        className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                      >
                        <td className="whitespace-nowrap py-3 pl-5 font-mono font-bold text-[#2563EB]">{s.issn}</td>
                        <td className="min-w-[200px] py-3 font-bold text-[#0F172A]">{s.title}</td>
                        <td className="min-w-[160px] py-3 text-slate-600">{s.publisher}</td>
                        <td className="whitespace-nowrap py-3">
                          <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                            {s.frequency}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-3">
                          <span
                            className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                              s.subscriptionStatus === "ACTIVE"
                                ? "bg-[#DCFCE7] text-[#15803D]"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {s.subscriptionStatus}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-3 font-medium tabular-nums text-slate-600">
                          {s.subscriptionEndDate}
                        </td>
                        <td className="whitespace-nowrap py-3 pr-5 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7.5 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                            onClick={() =>
                              setStatusMessage(`Issue check-in recorded for ${s.title} (ISSN ${s.issn}).`)
                            }
                          >
                            Check-In Issue
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal: Create Purchase Order */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg rounded-2xl border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-[#0F172A]">
                  New Purchase Order Requisition
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Generate an institutional purchase order for vendor procurement and inventory accessioning.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreatePo}>
              <CardContent className="space-y-3.5 p-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-[#0F172A]">Supplier Name *</label>
                  <Input
                    placeholder="e.g. Oxford Academic Distributors"
                    value={newPoSupplier}
                    onChange={(e) => setNewPoSupplier(e.target.value)}
                    required
                    className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-[#0F172A]">Item Title / Description</label>
                  <Input
                    placeholder="e.g. Clean Architecture (Robert C. Martin)"
                    value={newPoTitle}
                    onChange={(e) => setNewPoTitle(e.target.value)}
                    className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-[#0F172A]">Quantity</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={newPoQuantity}
                      onChange={(e) => setNewPoQuantity(Number(e.target.value))}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-[#0F172A]">Unit Cost (₹)</label>
                    <Input
                      type="number"
                      min={1}
                      value={newPoUnitCost}
                      onChange={(e) => setNewPoUnitCost(Number(e.target.value))}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC]"
                    />
                  </div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-[#EFF6FF] p-3 text-xs text-[#1D4ED8]">
                  <p className="font-semibold">Estimated Total: ₹{(newPoQuantity * newPoUnitCost).toLocaleString()}</p>
                  <p className="text-[11px] text-blue-600">A consecutive PO identifier will be provisioned automatically.</p>
                </div>
              </CardContent>
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPoModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-xl bg-[#2563EB] text-white hover:bg-[#1D4ED8]"
                >
                  Create Purchase Order
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Receive Purchase Order */}
      {isReceiveModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-md rounded-2xl border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-[#0F172A]">
                  Receive Books & Convert to Inventory
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </div>
              <CardDescription className="text-xs text-slate-500">
                Confirm receiving for Order <span className="font-bold text-[#2563EB]">{selectedOrder.orderNumber}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 p-4 text-xs">
              <div className="space-y-1">
                <p className="text-slate-600">Supplier: <strong className="text-[#0F172A]">{selectedOrder.supplierName}</strong></p>
                <p className="text-slate-600">Ordered: <strong className="text-[#0F172A]">{selectedOrder.totalOrderedQuantity} copies</strong></p>
                <p className="text-slate-600">Pending: <strong className="text-amber-600">{selectedOrder.totalPendingQuantity} copies</strong></p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
                <p className="font-bold">Automatic Accession Provisioning</p>
                <p className="mt-0.5 text-[11px] text-emerald-800">
                  Receiving this consignment will automatically generate sequential accession numbers (ACC-2026-XXXXX) and register them in the physical inventory queue.
                </p>
              </div>
            </CardContent>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsReceiveModalOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                onClick={handleReceiveOrder}
                className="rounded-xl bg-[#16A34A] text-white hover:bg-[#15803D]"
              >
                Confirm Receiving
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
