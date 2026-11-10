import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Search,
  LogOut,
  User,
  Settings,
  ChevronDown,
  Menu,
  Wifi,
  WifiOff,
  Database,
  Globe,
  Shield,
  FileText,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { checkBackendHealth, checkRfidHealth } from "@/lib/api";
import { getInitials } from "@/lib/utils";
import type { HealthStatus, RfidHealthResponse } from "@/types";

interface AppHeaderProps {
  onOpenMobileMenu?: () => void;
}

export function AppHeader({ onOpenMobileMenu }: AppHeaderProps) {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  // Shared lightweight status probes so every module header reflects live API & RFID health
  const { data: backendHealth, isSuccess: backendSuccess, isError: backendError } =
    useQuery<HealthStatus>({
      queryKey: ["health", "backend"],
      queryFn: checkBackendHealth,
      retry: 1,
      refetchInterval: 10_000,
      staleTime: 5_000,
    });

  const { data: rfidHealth, isSuccess: rfidSuccess, isError: rfidError } =
    useQuery<RfidHealthResponse>({
      queryKey: ["health", "rfid"],
      queryFn: checkRfidHealth,
      retry: 1,
      refetchInterval: 10_000,
      staleTime: 5_000,
    });

  const backendOnline =
    !backendError &&
    backendSuccess &&
    (backendHealth?.success === true ||
      backendHealth?.data?.api === "ONLINE" ||
      backendHealth?.data?.status === "HEALTHY" ||
      backendHealth?.data?.status === "DEGRADED" ||
      backendHealth?.status === "HEALTHY" ||
      backendHealth?.status === "ok");

  const dbConnected = backendHealth?.data?.database?.status === "CONNECTED";

  const rfidOnline =
    !rfidError &&
    rfidSuccess &&
    (rfidHealth?.status === "HEALTHY" ||
      rfidHealth?.status === "ONLINE" ||
      rfidHealth?.status === "ok" ||
      rfidHealth?.service === "smartlib-rfid-middleware" ||
      typeof rfidHealth?.devices_online === "number");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/books?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  };

  const displayName = user?.name || "Chief Librarian";
  const displayRole = user?.role || "LIBRARIAN";

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200/85 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      <div className="flex flex-1 items-center gap-3">
        {/* Mobile Menu Trigger */}
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation drawer"
          >
            <Menu className="size-5" />
          </button>
        )}

        {/* Global Search Bar (Matching Reference Image) */}
        <form onSubmit={handleSearch} className="w-full max-w-xs sm:max-w-md min-w-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search books, members, accession no., RFID tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full min-w-0 rounded-xl border border-slate-200/90 bg-slate-50/80 pl-10 pr-4 text-sm text-[#0F172A] placeholder:text-slate-400 transition-all focus:border-[#2563EB] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
            />
          </div>
        </form>
      </div>

      {/* Right Status Pills, Notification Bell & User Profile */}
      <div className="flex shrink-0 items-center gap-2.5 sm:gap-4">
        {/* Compact System Status Pills (Hidden on small mobile, visible on tablet/desktop) */}
        <div className="hidden xl:flex shrink-0 whitespace-nowrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            {backendOnline ? (
              <Wifi className="size-3.5 text-[#16A34A]" />
            ) : (
              <WifiOff className="size-3.5 text-[#DC2626]" />
            )}
            <span>API</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                backendOnline
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {backendOnline ? "Online" : "Offline"}
            </span>
          </span>

          <span className="h-3.5 w-px bg-slate-200" />

          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            {rfidOnline ? (
              <Wifi className="size-3.5 text-[#0D9488]" />
            ) : (
              <WifiOff className="size-3.5 text-[#DC2626]" />
            )}
            <span>RFID</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                rfidOnline
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {rfidOnline ? "Online" : "Offline"}
            </span>
          </span>

          {backendOnline && (
            <>
              <span className="h-3.5 w-px bg-slate-200" />
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                <Database
                  className={`size-3 ${
                    dbConnected ? "text-[#2563EB]" : "text-[#F59E0B]"
                  }`}
                />
                <span>{dbConnected ? "DB OK" : "DB Check"}</span>
              </span>
            </>
          )}
        </div>

        {/* Notifications Bell with Unread Badge */}
        <Link
          to="/notifications"
          className="relative flex size-10 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-700 shadow-2xs transition-colors hover:border-blue-300 hover:bg-blue-50/50"
          aria-label="Notifications"
        >
          <Bell className="size-4.5" />
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-[#DC2626] text-[10px] font-bold text-white ring-2 ring-white">
            3
          </span>
        </Link>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
            >
              <Avatar className="size-9 border-2 border-blue-100 shadow-xs">
                <AvatarFallback className="bg-[#2563EB] text-xs font-bold text-white">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:flex sm:flex-col">
                <span className="max-w-36 truncate text-sm font-bold leading-tight text-[#0F172A]">
                  {displayName}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {displayRole}
                </span>
              </div>
              <ChevronDown className="size-4 text-slate-400 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-2.5 py-2">
              <p className="text-xs font-bold text-[#0F172A]">{displayName}</p>
              <p className="text-[11px] font-normal text-slate-500">
                {user?.email || "Staff Account"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="size-4 text-slate-500" />
              <span>My Profile & Preferences</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="size-4 text-slate-500" />
              <span>System Settings</span>
            </DropdownMenuItem>
            {hasRole(["ADMIN"]) && (
              <>
                <DropdownMenuItem onClick={() => navigate("/roles")}>
                  <Shield className="size-4 text-slate-500" />
                  <span>Roles & Permissions</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/audit")}>
                  <FileText className="size-4 text-slate-500" />
                  <span>Audit Trail</span>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => navigate("/opac")}>
              <Globe className="size-4 text-slate-500" />
              <span>Public OPAC Portal</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[#DC2626] focus:bg-rose-50 focus:text-[#DC2626]"
              onClick={logout}
            >
              <LogOut className="size-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
