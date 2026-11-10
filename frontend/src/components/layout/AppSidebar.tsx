import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Home,
  BookOpen,
  BookMarked,
  ShoppingBag,
  Newspaper,
  Users,
  ArrowLeftRight,
  Tag,
  Cpu,
  PackageSearch,
  ShieldCheck,
  Upload,
  BarChart3,
  Bell,
  QrCode,
  Settings,
  UserCog,
  FileText,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  to: string;
  matchPaths?: string[];
  icon: React.ElementType;
  requiredRoles?: string[];
  badgeDot?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "OVERVIEW",
    items: [{ label: "Dashboard", to: "/", icon: Home }],
  },
  {
    label: "LIBRARY OPERATIONS",
    items: [
      { label: "Book Catalog", to: "/books", icon: BookOpen },
      { label: "Cataloguing", to: "/cataloguing", icon: BookMarked },
      { label: "Acquisition Management", to: "/acquisitions", icon: ShoppingBag },
      { label: "Serials Management", to: "/serials", icon: Newspaper },
      { label: "Members", to: "/members", icon: Users },
      { label: "Circulation", to: "/circulation", icon: ArrowLeftRight },
    ],
  },
  {
    label: "RFID & INVENTORY",
    items: [
      { label: "RFID Tagging", to: "/rfid/tagging", icon: Tag },
      { label: "RFID Devices", to: "/rfid/devices", icon: Cpu },
      { label: "Inventory Management", to: "/inventory", icon: PackageSearch },
      { label: "Security Gate", to: "/security-gate", icon: ShieldCheck },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { label: "Data Migration", to: "/migration", icon: Upload },
      { label: "Reports & Analytics", to: "/reports", icon: BarChart3 },
      { label: "Notifications", to: "/notifications", icon: Bell, badgeDot: true },
      { label: "Barcode & Spine Labels", to: "/labels", icon: QrCode },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "System Settings", to: "/settings", icon: Settings },
      {
        label: "User & Role Management",
        to: "/users",
        matchPaths: ["/users", "/roles"],
        icon: UserCog,
        requiredRoles: ["ADMIN"],
      },
      { label: "Audit Logs", to: "/audit", icon: FileText, requiredRoles: ["ADMIN"] },
      {
        label: "System Health",
        to: "/backup",
        icon: Activity,
        requiredRoles: ["ADMIN"],
      },
    ],
  },
];

function SidebarSmartLibLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2.5">
        <svg
          viewBox="0 0 80 76"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={cn("shrink-0 transition-all", collapsed ? "size-9" : "size-11")}
          aria-hidden="true"
        >
          {/* RFID Signal Waves */}
          <path
            d="M27 16C34.5 9.5 45.5 9.5 53 16"
            stroke="#38BDF8"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <path
            d="M31.5 22C36.5 17.8 43.5 17.8 48.5 22"
            stroke="#38BDF8"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          <path
            d="M36 28C38.5 26 41.5 26 44 28"
            stroke="#38BDF8"
            strokeWidth="3.8"
            strokeLinecap="round"
          />
          {/* Book Base */}
          <path
            d="M11 33C11 31.3 12.4 30 14.1 30.2C24 31.3 33.5 34.8 40 39.5C46.5 34.8 56 31.3 65.9 30.2C67.6 30 69 31.3 69 33V63.5C69 65.2 67.5 66.5 65.8 66.3C55.8 65.2 46.5 67.5 40 71.5C33.5 67.5 24.2 65.2 14.2 66.3C12.5 66.5 11 65.2 11 63.5V33Z"
            fill="#FFFFFF"
            stroke="#071B3A"
            strokeWidth="2"
          />
          <path
            d="M15 27.5C24.5 28.5 33 32 39 36.8V66.5C33 62.2 24.5 59.5 15 58.8V27.5Z"
            fill="#38BDF8"
          />
          <path
            d="M65 27.5C55.5 28.5 47 32 41 36.8V66.5C47 62.2 55.5 59.5 65 58.8V27.5Z"
            fill="#0284C7"
          />
          <line
            x1="40"
            y1="36"
            x2="40"
            y2="67"
            stroke="#FFFFFF"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>

        {!collapsed && (
          <span className="text-2xl font-extrabold tracking-tight">
            <span className="text-white">Smart</span>
            <span className="text-[#38BDF8]">Lib</span>
          </span>
        )}
      </div>

      {!collapsed && (
        <p className="mt-1 text-center text-[11px] font-medium leading-tight text-slate-300/85">
          RFID-Enabled Integrated
          <br />
          Library Management
        </p>
      )}
    </div>
  );
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasRole } = useAuth();
  const location = useLocation();

  const renderSidebarContent = (isMobileDrawer = false) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;

    return (
      <div className="relative flex h-full flex-col overflow-hidden bg-[#071B3A] text-white select-none">
        {/* Top Brand Area */}
        <div
          className={cn(
            "relative z-10 flex flex-col border-b border-white/10 px-4 pt-5 pb-4",
            isCollapsed ? "items-center" : "items-center"
          )}
        >
          <div className="flex w-full items-start justify-between">
            <div className="flex-1 flex justify-center">
              <SidebarSmartLibLogo collapsed={isCollapsed} />
            </div>
            {isMobileDrawer ? (
              <button
                type="button"
                onClick={onMobileClose}
                className="flex size-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(!collapsed)}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5" />
                ) : (
                  <ChevronLeft className="size-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <div className="relative z-10 flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          <nav className="flex flex-col gap-1" aria-label="Main Navigation">
            {NAV_GROUPS.map((group, gi) => {
              const visibleItems = group.items.filter(
                (item) => !item.requiredRoles || hasRole(item.requiredRoles)
              );
              if (visibleItems.length === 0) return null;

              return (
                <div key={gi} className="mb-2">
                  {!isCollapsed && (
                    <p className="mb-1.5 px-3 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400/90">
                      {group.label}
                    </p>
                  )}
                  {isCollapsed && gi > 0 && (
                    <div className="my-2 h-px bg-white/10" />
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      const isActive =
                        item.to === "/"
                          ? location.pathname === "/"
                          : item.matchPaths
                            ? item.matchPaths.some((p) => location.pathname.startsWith(p))
                            : location.pathname.startsWith(item.to);

                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => {
                            if (isMobileDrawer && onMobileClose) onMobileClose();
                          }}
                          className={cn(
                            "group relative flex h-9 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-150",
                            isActive
                              ? "bg-gradient-to-r from-[#2563EB] to-[#38BDF8] font-semibold text-white shadow-[0_4px_14px_rgba(37,99,235,0.4)]"
                              : "text-slate-300 hover:bg-[#102A56] hover:text-white",
                            isCollapsed && "justify-center px-0"
                          )}
                          title={isCollapsed ? item.label : undefined}
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              isActive
                                ? "text-white"
                                : "text-slate-400 group-hover:text-[#38BDF8]"
                            )}
                          />
                          {!isCollapsed && (
                            <span className="flex-1 truncate" title={item.label}>
                              {item.label}
                            </span>
                          )}
                          {!isCollapsed && item.badgeDot && (
                            <span
                              className={cn(
                                "size-2 rounded-full",
                                isActive
                                  ? "bg-white"
                                  : "bg-[#38BDF8] shadow-[0_0_8px_#38BDF8]"
                              )}
                            />
                          )}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Decorative Open-Book & Royal Wave Footer (Matching Reference Image) */}
        {!isCollapsed && (
          <div
            className="pointer-events-none relative z-0 h-24 w-full shrink-0 overflow-hidden"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 240 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-full w-full"
              preserveAspectRatio="none"
            >
              {/* Soft Ambient Glow */}
              <path
                d="M0 68C58 42 150 86 240 48V100H0V68Z"
                fill="#0D2D62"
                fillOpacity="0.65"
              />
              <path
                d="M0 80C76 58 168 95 240 66V100H0V80Z"
                fill="#153E85"
                fillOpacity="0.55"
              />
              {/* Open Book Silhouette */}
              <path
                d="M120 56C104 46 84 44 68 48V28C84 24 104 26 120 36C136 26 156 24 172 28V48C156 44 136 46 120 56Z"
                fill="#38BDF8"
                fillOpacity="0.18"
                stroke="#60A5FA"
                strokeOpacity="0.35"
                strokeWidth="1.2"
              />
              <path
                d="M120 36V56"
                stroke="#93C5FD"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-screen shrink-0 flex-col border-r border-slate-800/80 bg-[#071B3A] transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[264px]"
        )}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile & Tablet Responsive Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onMobileClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-64 flex-col shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
