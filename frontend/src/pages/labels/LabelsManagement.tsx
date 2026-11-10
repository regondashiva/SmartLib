import React, { useState, useEffect } from "react";
import { Barcode, Printer, FileDown, Tag, Layers, Search, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api as apiClient } from "@/lib/api";

interface PreviewLabelItem {
  bookItemId: string;
  accessionNumber: string;
  barcode: string;
  title: string;
  author: string;
  callNumber: string;
  shelfLocation: string;
  spineLines: string[];
  barcodeSvg: string;
}

export default function LabelsManagementPage() {
  const [accessionInput, setAccessionInput] = useState("");
  const [layoutPreset, setLayoutPreset] = useState<
    "AVERY_5160_30UP" | "SPINE_STANDARD_38X25" | "THERMAL_ROLL_50X30" | "CUSTOM"
  >("AVERY_5160_30UP");
  const [labelType, setLabelType] = useState<"BARCODE" | "SPINE" | "COMBINED">("COMBINED");
  const [widthMm, setWidthMm] = useState(66.7);
  const [heightMm, setHeightMm] = useState(25.4);
  const [labels, setLabels] = useState<PreviewLabelItem[]>([]);
  const [statusMessage, setStatusMessage] = useState("");

  const loadPreview = async () => {
    try {
      const accessionNumbers = accessionInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiClient.post("/labels/preview", {
        accessionNumbers: accessionNumbers.length > 0 ? accessionNumbers : undefined,
        layoutPreset,
        widthMm,
        heightMm,
        labelType,
      });
      setLabels(res.data?.data?.labels || []);
      setStatusMessage(
        `Generated ${res.data?.data?.totalLabels || 0} printable barcode & spine labels (Code-128B)`
      );
    } catch {
      setLabels([]);
    }
  };

  const downloadPdf = async () => {
    try {
      const accessionNumbers = accessionInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiClient.post(
        "/labels/pdf",
        {
          accessionNumbers: accessionNumbers.length > 0 ? accessionNumbers : undefined,
          layoutPreset,
          widthMm,
          heightMm,
          labelType,
        },
        { responseType: "blob" }
      );
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartlib-labels-${labelType.toLowerCase()}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      setStatusMessage("Print-ready PDF label sheet downloaded");
    } catch {
      setStatusMessage("Failed to generate PDF label sheet");
    }
  };

  useEffect(() => {
    loadPreview();
  }, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Physical Copy Barcode & Spine-Label Generator"
        description="Generate ISO/IEC 15417 Code-128B barcodes and DDC/LCC spine labels with print-ready PDF sheets."
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "Barcode & Spine Labels" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={loadPreview}>
              <Printer className="size-4" />
              Refresh Preview
            </Button>
            <Button type="button" size="sm" onClick={downloadPdf}>
              <FileDown className="size-4" />
              Export Print-Ready PDF
            </Button>
          </div>
        }
      />

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Labels in Current Sheet"
          value={labels.length}
          icon={Barcode}
          variant="default"
        />
        <StatCard
          label="Symbology Standard"
          value="Code-128B"
          icon={Tag}
          variant="rfid"
        />
        <StatCard
          label="Sheet Dimensions"
          value={`${widthMm} × ${heightMm} mm`}
          icon={Layers}
          variant="indigo"
        />
        <StatCard
          label="Output Mode"
          value={labelType}
          icon={CheckCircle2}
          variant="success"
        />
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-2.5 text-xs font-medium text-[#1D4ED8]">
          {statusMessage} • Note: Generated barcode graphics are printable labels only and are not hardware scan events.
        </div>
      )}

      {/* Configuration Controls */}
      <Card>
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
          <CardTitle className="text-sm font-bold text-[#0F172A]">
            Sheet Configuration & Layout Selection
          </CardTitle>
          <CardDescription>
            Filter by accession numbers and select label sheet dimensions for laser or thermal label printers
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Filter by Accession Numbers (comma-separated)
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={accessionInput}
                onChange={(e) => setAccessionInput(e.target.value)}
                placeholder="e.g. ACC-2026-00001, ACC-2026-00002"
                className="pl-8 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Label Sheet Layout Preset
            </label>
            <select
              aria-label="Label Sheet Layout Preset"
              value={layoutPreset}
              onChange={(e) =>
                setLayoutPreset(
                  e.target.value as
                    | "AVERY_5160_30UP"
                    | "SPINE_STANDARD_38X25"
                    | "THERMAL_ROLL_50X30"
                    | "CUSTOM"
                )
              }
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="AVERY_5160_30UP">Avery 5160 (30-Up • 66.7 × 25.4 mm)</option>
              <option value="SPINE_STANDARD_38X25">Standard Spine Label (38.0 × 25.0 mm)</option>
              <option value="THERMAL_ROLL_50X30">Thermal Direct Roll (50.0 × 30.0 mm)</option>
              <option value="CUSTOM">Custom Dimensions (mm)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              Label Output Mode
            </label>
            <select
              aria-label="Label Output Mode"
              value={labelType}
              onChange={(e) => setLabelType(e.target.value as "BARCODE" | "SPINE" | "COMBINED")}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="COMBINED">Combined Barcode + Spine Label</option>
              <option value="BARCODE">Barcode Label Only</option>
              <option value="SPINE">Spine Classification Label Only</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Width (mm)
              </label>
              <Input
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(Number(e.target.value))}
                className="text-xs"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Height (mm)
              </label>
              <Input
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(Number(e.target.value))}
                className="text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print-Ready Label Preview Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {labels.map((item) => (
          <Card
            key={item.bookItemId}
            className="overflow-hidden border-slate-200/90 hover:border-blue-300"
          >
            <CardContent className="flex items-center justify-between gap-4 p-4">
              {(labelType === "COMBINED" || labelType === "BARCODE") && (
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-[#0F172A]">
                      {item.title}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {item.shelfLocation}
                    </Badge>
                  </div>
                  <div
                    className="inline-block rounded-lg border border-slate-200 bg-white p-2 shadow-2xs"
                    dangerouslySetInnerHTML={{ __html: item.barcodeSvg }}
                  />
                  <div className="font-mono text-[11px] font-semibold text-slate-600">
                    Acc: {item.accessionNumber}
                  </div>
                </div>
              )}

              {(labelType === "COMBINED" || labelType === "SPINE") && (
                <div className="w-28 shrink-0 rounded-xl border-2 border-slate-300 bg-amber-50/90 p-2.5 text-center font-mono text-xs leading-tight text-[#0F172A] shadow-2xs">
                  <div className="mb-1 border-b border-amber-200 pb-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-800">
                    SPINE
                  </div>
                  {item.spineLines.map((line, i) => (
                    <div key={i} className="font-extrabold">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
