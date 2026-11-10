import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  BookOpen,
  Search,
  BarChart3,
  Wifi,
  Loader2,
  Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Custom SmartLib Open-Book + RFID Waves Emblem SVG
 */
function SmartLibEmblem({
  waveColor = "#F59E0B",
  bookPrimary = "#38BDF8",
  bookSecondary = "#0284C7",
  outlineColor = "#FFFFFF",
  className = "w-14 h-14",
}: {
  waveColor?: string;
  bookPrimary?: string;
  bookSecondary?: string;
  outlineColor?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 80 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* RFID Signal Waves */}
      <path
        d="M27 16C34.5 9.5 45.5 9.5 53 16"
        stroke={waveColor}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M31.5 22C36.5 17.8 43.5 17.8 48.5 22"
        stroke={waveColor}
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      <path
        d="M36 28C38.5 26 41.5 26 44 28"
        stroke={waveColor}
        strokeWidth="3.6"
        strokeLinecap="round"
      />

      {/* Outer Book Base Frame */}
      <path
        d="M11 33C11 31.3 12.4 30 14.1 30.2C24 31.3 33.5 34.8 40 39.5C46.5 34.8 56 31.3 65.9 30.2C67.6 30 69 31.3 69 33V63.5C69 65.2 67.5 66.5 65.8 66.3C55.8 65.2 46.5 67.5 40 71.5C33.5 67.5 24.2 65.2 14.2 66.3C12.5 66.5 11 65.2 11 63.5V33Z"
        fill={outlineColor}
        stroke="#0F1F3D"
        strokeWidth="2.5"
      />

      {/* Left Book Page */}
      <path
        d="M15 27.5C24.5 28.5 33 32 39 36.8V66.5C33 62.2 24.5 59.5 15 58.8V27.5Z"
        fill={bookPrimary}
      />

      {/* Right Book Page */}
      <path
        d="M65 27.5C55.5 28.5 47 32 41 36.8V66.5C47 62.2 55.5 59.5 65 58.8V27.5Z"
        fill={bookSecondary}
      />

      {/* Center Spine Highlight */}
      <line
        x1="40"
        y1="36"
        x2="40"
        y2="67"
        stroke={outlineColor}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Illustrated Stack of RFID-Tagged Library Books & Handheld RFID Scanner on Desk
 */
function LibraryDeskRfidIllustration() {
  return (
    <div
      className="relative w-full max-w-[420px] xl:max-w-[500px] select-none"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 560 216"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto max-h-[22vh] xl:max-h-[25vh] w-full object-contain object-left-bottom drop-shadow-[0_14px_24px_rgba(0,0,0,0.5)]"
      >
        <defs>
          <linearGradient id="deskSurface" x1="0" y1="176" x2="560" y2="220" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6B3E26" />
            <stop offset="45%" stopColor="#4A2816" />
            <stop offset="100%" stopColor="#2A150B" />
          </linearGradient>
          <linearGradient id="topBookCover" x1="60" y1="55" x2="225" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E3A8A" />
          </linearGradient>
          <linearGradient id="midBookSpine" x1="52" y1="95" x2="235" y2="138" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#D99B52" />
            <stop offset="50%" stopColor="#B77932" />
            <stop offset="100%" stopColor="#8C581E" />
          </linearGradient>
          <linearGradient id="botBookSpine" x1="48" y1="138" x2="242" y2="178" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#0F2147" />
          </linearGradient>
          <linearGradient id="rfidBadgeGlow" x1="125" y1="103" x2="198" y2="132" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="scannerBody" x1="310" y1="58" x2="435" y2="180" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="55%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
          <filter id="blueGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Wooden Desk Top Surface & Edge */}
        <path d="M0 176H540L555 194H0V176Z" fill="url(#deskSurface)" />
        <rect x="0" y="194" width="555" height="22" rx="3" fill="#23120A" />
        <line x1="0" y1="194" x2="555" y2="194" stroke="#8B5A3C" strokeWidth="1.5" strokeOpacity="0.6" />

        {/* Subtle Potted Plant Leaf Accents (Far Left) */}
        <path
          d="M12 176L22 142H0L6 176H12Z"
          fill="#7C4728"
        />
        <path
          d="M10 142C2 122 -4 104 8 88C16 104 18 122 12 142Z"
          fill="#22C55E"
          fillOpacity="0.85"
        />
        <path
          d="M14 142C24 120 38 106 46 95C38 116 26 130 14 142Z"
          fill="#16A34A"
          fillOpacity="0.9"
        />

        {/* ==================== BOTTOM BOOK (Dark Navy Hardcover) ==================== */}
        <path
          d="M46 144C46 140 50 137 55 137H234V174H55C50 174 46 170 46 165V144Z"
          fill="url(#botBookSpine)"
          stroke="#334E85"
          strokeWidth="1.2"
        />
        {/* Bottom Book Pages Block */}
        <rect x="192" y="141" width="40" height="29" rx="1" fill="#E2E8F0" />
        <line x1="194" y1="146" x2="230" y2="146" stroke="#94A3B8" strokeWidth="1" />
        <line x1="194" y1="152" x2="230" y2="152" stroke="#94A3B8" strokeWidth="1" />
        <line x1="194" y1="158" x2="230" y2="158" stroke="#94A3B8" strokeWidth="1" />
        <line x1="194" y1="164" x2="230" y2="164" stroke="#94A3B8" strokeWidth="1" />
        {/* Gold Spine Bands */}
        <line x1="88" y1="138" x2="88" y2="173" stroke="#F59E0B" strokeWidth="2" strokeOpacity="0.65" />
        <line x1="165" y1="138" x2="165" y2="173" stroke="#F59E0B" strokeWidth="2" strokeOpacity="0.65" />

        {/* ==================== MIDDLE BOOK (Warm Gold/Tan with RFID Badge) ==================== */}
        <path
          d="M52 103C52 99 56 96 61 96H226V136H61C56 136 52 132 52 127V103Z"
          fill="url(#midBookSpine)"
          stroke="#FBBF24"
          strokeWidth="1"
          strokeOpacity="0.5"
        />
        {/* Gold Bookmark Ribbon Hanging Down */}
        <path d="M108 118H117V152L112.5 147L108 152V118Z" fill="#F59E0B" />
        {/* Illuminated RFID Tag Badge on Spine */}
        <rect
          x="126"
          y="102"
          width="74"
          height="27"
          rx="5"
          fill="url(#rfidBadgeGlow)"
          stroke="#60A5FA"
          strokeWidth="2"
          filter="url(#blueGlow)"
        />
        <text
          x="134"
          y="120"
          fill="#FFFFFF"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="800"
          fontSize="14"
          letterSpacing="0.5"
        >
          RFID
        </text>
        {/* Small wave arcs inside RFID badge */}
        <path d="M174 111C177 113.5 177 117.5 174 120" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M179 108.5C183 112.5 183 118.5 179 122.5" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M184 106C189 111.5 189 119.5 184 125" stroke="#93C5FD" strokeWidth="1.8" strokeLinecap="round" />

        {/* ==================== TOP BOOK (Royal Blue Hardcover) ==================== */}
        {/* 3D Top Slanted Cover */}
        <path
          d="M66 64L122 46L222 57L176 74L66 64Z"
          fill="#3B82F6"
          stroke="#60A5FA"
          strokeWidth="1"
        />
        {/* Top Book Spine & Page Edges */}
        <path
          d="M64 64H178V96H64C60 96 58 92 58 88V70C58 66 60 64 64 64Z"
          fill="url(#topBookCover)"
        />
        <polygon points="178,64 222,57 222,87 178,96" fill="#F1F5F9" />
        <line x1="180" y1="71" x2="220" y2="64" stroke="#CBD5E1" strokeWidth="1.2" />
        <line x1="180" y1="78" x2="220" y2="71" stroke="#CBD5E1" strokeWidth="1.2" />
        <line x1="180" y1="85" x2="220" y2="78" stroke="#CBD5E1" strokeWidth="1.2" />

        {/* ==================== WIRELESS RFID SCAN WAVES ((( ==================== */}
        <path
          d="M276 94C266 105 266 123 276 134"
          stroke="#38BDF8"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#blueGlow)"
        />
        <path
          d="M263 85C249 101 249 127 263 143"
          stroke="#38BDF8"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
        <path
          d="M250 76C232 97 232 131 250 152"
          stroke="#0EA5E9"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeOpacity="0.65"
        />

        {/* ==================== HANDHELD RFID SCANNER & DESK CRADLE ==================== */}
        {/* Desk Base Cradle */}
        <path
          d="M362 162L426 156L442 178H348L362 162Z"
          fill="#0F172A"
          stroke="#334155"
          strokeWidth="1.5"
        />
        {/* Scanner Handle */}
        <path
          d="M352 94L392 84L428 164L388 168L352 94Z"
          fill="url(#scannerBody)"
          stroke="#475569"
          strokeWidth="1.5"
        />
        {/* Orange Trigger Button */}
        <path d="M353 108L362 106L368 122L358 124L353 108Z" fill="#F59E0B" />
        {/* Scanner Head Pod */}
        <path
          d="M298 76C296 63 306 52 324 50L382 45C396 44 406 54 404 68L398 88C395 96 385 100 372 100L314 98C304 97 299 88 298 76Z"
          fill="url(#scannerBody)"
          stroke="#38BDF8"
          strokeWidth="1.5"
        />
        {/* Glowing Blue Scanner Lens Window */}
        <ellipse
          cx="336"
          cy="56"
          rx="26"
          ry="7"
          transform="rotate(-6 336 56)"
          fill="#38BDF8"
          filter="url(#blueGlow)"
        />
        <path
          d="M300 78C312 83 328 84 345 81"
          stroke="#38BDF8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/";

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [forgotPasswordNotice, setForgotPasswordNotice] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    setForgotPasswordNotice(false);
    try {
      await login(values);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      setAuthError(msg ?? "Invalid credentials. Please try again.");
    }
  };

  const fillDemoCredentials = (role: "ADMIN" | "LIBRARIAN") => {
    setAuthError(null);
    setForgotPasswordNotice(false);
    if (role === "ADMIN") {
      setValue("email", "admin@smartlib.ac.in", { shouldValidate: true });
      setValue("password", "Admin@SmartLib2026!", { shouldValidate: true });
    } else {
      setValue("email", "librarian@smartlib.ac.in", { shouldValidate: true });
      setValue("password", "Lib@SmartLib2026!", { shouldValidate: true });
    }
  };

  const featureHighlights = [
    {
      icon: Wifi,
      line1: "RFID",
      line2: "Integration",
    },
    {
      icon: BookOpen,
      line1: "Smart",
      line2: "Circulation",
    },
    {
      icon: Search,
      line1: "Public",
      line2: "OPAC",
    },
    {
      icon: BarChart3,
      line1: "Reports &",
      line2: "Analytics",
    },
  ];

  return (
    <div className="relative h-[100dvh] min-h-[100svh] max-lg:h-auto w-full overflow-x-hidden lg:overflow-y-hidden bg-[#0a162c] font-sans text-slate-900 grid grid-cols-1 lg:grid-cols-12">
      {/* ===================================================================== */}
      {/* AMBIENT LIBRARY BACKGROUND & WARM LIGHTING                            */}
      {/* ===================================================================== */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(circle at 52% 8%, rgba(251, 191, 36, 0.16) 0%, rgba(14, 30, 62, 0.88) 42%, #081226 100%)",
        }}
      />
      {/* Warm Overhead Halo Ring Accent (Top Center-Left, matching reference) */}
      <div
        className="pointer-events-none absolute -top-24 left-[36%] hidden h-56 w-[400px] -rotate-12 rounded-full border-[4px] border-amber-200/35 shadow-[0_0_45px_rgba(251,191,36,0.26)] lg:block"
        aria-hidden="true"
      />
      {/* Subtle Bookshelf Vertical Depth Columns on Far Left */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-14 bg-gradient-to-r from-[#2b170c]/75 via-[#1c110b]/40 to-transparent xl:block"
        aria-hidden="true"
      />

      {/* ===================================================================== */}
      {/* LEFT PANEL — SMARTLIB BRANDING, TAGLINE, FEATURES & RFID ILLUSTRATION */}
      {/* ===================================================================== */}
      <div className="relative z-10 flex w-full flex-col justify-between px-6 pt-6 pb-4 sm:px-10 lg:col-span-7 lg:h-full lg:px-12 xl:px-16 lg:pt-6 xl:pt-8 lg:pb-0">
        <div>
          {/* Top Brand Header */}
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              <SmartLibEmblem
                waveColor="#F59E0B"
                bookPrimary="#38BDF8"
                bookSecondary="#0284C7"
                outlineColor="#FFFFFF"
                className="h-11 w-11 xl:h-12 xl:w-12 shrink-0"
              />
              <span className="text-2xl font-extrabold tracking-tight sm:text-3xl xl:text-[34px]">
                <span className="text-white">Smart</span>
                <span className="text-[#38bdf8]">Lib</span>
              </span>
            </div>

            <div className="hidden h-8 w-px bg-slate-500/50 sm:block" />

            <div className="text-[11px] font-medium leading-tight text-slate-200 sm:text-xs xl:text-[13px]">
              <p>RFID-Enabled Integrated</p>
              <p>Library Management System</p>
            </div>
          </div>

          {/* Main Hero Headline */}
          <div className="mt-4 sm:mt-5 xl:mt-6">
            <h1 className="text-2xl font-extrabold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[36px] xl:text-[44px]">
              The Future of
              <br />
              Library Management
              <br />
              <span className="relative inline-block text-[#38bdf8]">
                Starts Here.
                {/* Subtle Amber Brush Underline */}
                <svg
                  viewBox="0 0 240 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="mt-1 h-2 w-36 sm:w-44 xl:w-52"
                  aria-hidden="true"
                >
                  <path
                    d="M3 8.5C58 2.5 142 2 237 7.5"
                    stroke="#F59E0B"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>

            <p className="mt-3 xl:mt-4 max-w-lg text-xs leading-relaxed text-slate-200/90 sm:text-[13px] xl:text-[15px]">
              A comprehensive, RFID-powered library platform for cataloguing,
              circulation, inventory, security and intelligent library services.
            </p>
          </div>

          {/* 4 Feature Highlight Cards */}
          <div className="mt-4 xl:mt-5 grid max-w-lg grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {featureHighlights.map((item) => {
              const IconComponent = item.icon;
              return (
                <div
                  key={item.line1 + item.line2}
                  className="group flex flex-col items-center justify-center rounded-xl border border-slate-400/20 bg-[#112240]/75 px-2.5 py-2.5 xl:py-3 text-center backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#38bdf8]/45 hover:bg-[#162b50]/85"
                >
                  <div className="mb-1.5 flex h-8 w-8 xl:h-9 xl:w-9 items-center justify-center rounded-lg bg-[#38bdf8]/10 text-[#38bdf8] transition-colors group-hover:bg-[#38bdf8]/20">
                    <IconComponent className="h-4 w-4 xl:h-[18px] xl:w-[18px]" />
                  </div>
                  <span className="text-[11px] font-semibold leading-tight text-slate-100 xl:text-xs">
                    {item.line1}
                    <br />
                    {item.line2}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Library Desk, RFID Books & Handheld Scanner Illustration */}
        <div className="mt-3 hidden lg:block">
          <LibraryDeskRfidIllustration />
        </div>
      </div>

      {/* ===================================================================== */}
      {/* RIGHT PANEL — CURVED WAVE BACKDROP & ELEVATED WHITE LOGIN CARD        */}
      {/* ===================================================================== */}
      <div className="relative z-10 flex w-full items-center justify-center px-4 py-6 sm:px-8 lg:col-span-5 lg:h-full lg:py-4 lg:pr-10 xl:pr-14">
        {/* Diagonal / Curved Soft Slate-White Split Background on Desktop */}
        <div
          className="pointer-events-none absolute inset-y-0 -left-16 right-0 hidden lg:block"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 600 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <path
              d="M110 0C35 240 135 560 15 1000H600V0H110Z"
              fill="#EDF2FA"
            />
            {/* Bottom-Right Royal Blue Wave Corner Accent */}
            <path
              d="M230 1000C340 940 475 910 600 770V1000H230Z"
              fill="#1E40AF"
              fillOpacity="0.92"
            />
          </svg>
          {/* Subtle Watermark Book Icon in Bottom-Right Corner */}
          <div className="absolute bottom-4 right-6 opacity-25">
            <BookOpen className="h-12 w-12 text-white" />
          </div>
        </div>

        {/* Elevated White Login Card */}
        <div className="relative z-10 w-full max-w-[410px] xl:max-w-[430px] rounded-[24px] bg-white px-6 py-5 shadow-[0_20px_56px_rgba(8,18,38,0.28)] ring-1 ring-slate-200/80 sm:px-8 sm:py-6 xl:py-7">
          {/* Card Brand Header */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2">
              <SmartLibEmblem
                waveColor="#0F2952"
                bookPrimary="#2563EB"
                bookSecondary="#1D4ED8"
                outlineColor="#FFFFFF"
                className="h-10 w-10 xl:h-11 xl:w-11"
              />
              <div className="flex flex-col items-start">
                <span className="text-2xl font-extrabold tracking-tight sm:text-[26px] xl:text-[28px]">
                  <span className="text-[#0f1f3d]">Smart</span>
                  <span className="text-[#1d4ed8]">Lib</span>
                </span>
                {/* Soft Blue Wave Accent Under SmartLib */}
                <svg
                  viewBox="0 0 160 12"
                  fill="none"
                  className="-mt-0.5 h-2 w-28 xl:w-32"
                  aria-hidden="true"
                >
                  <path
                    d="M4 8C42 2 108 12 156 4"
                    stroke="#DBEAFE"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>

            <h2 className="mt-2.5 xl:mt-3.5 text-xl font-extrabold tracking-tight text-[#0f1f3d] sm:text-2xl">
              Welcome Back!
            </h2>
            <p className="mt-1 text-xs text-slate-600 xl:text-[13px]">
              Sign in to access your intelligent library workspace.
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 xl:mt-5 space-y-3" noValidate>
            {/* Username or Email Field */}
            <div>
              <label htmlFor="email" className="sr-only">
                Username or Email
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 xl:h-[18px] xl:w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  placeholder="Username or Email"
                  autoComplete="email"
                  className="h-10 xl:h-11 w-full rounded-xl border border-slate-300/90 bg-slate-50/70 pl-10 pr-4 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#1d4ed8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-[11px] font-medium text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 xl:h-[18px] xl:w-[18px] -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  autoComplete="current-password"
                  className="h-10 xl:h-11 w-full rounded-xl border border-slate-300/90 bg-slate-50/70 pl-10 pr-10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#1d4ed8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:text-slate-700"
                >
                  {showPassword ? (
                    <Eye className="h-4 w-4 xl:h-[18px] xl:w-[18px]" />
                  ) : (
                    <EyeOff className="h-4 w-4 xl:h-[18px] xl:w-[18px]" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-[11px] font-medium text-red-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password Row */}
            <div className="flex items-center justify-between pt-0.5 text-xs">
              <label className="inline-flex cursor-pointer items-center gap-2 select-none text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                    rememberMe
                      ? "border-[#1d4ed8] bg-[#1d4ed8] text-white"
                      : "border-slate-300 bg-white"
                  }`}
                >
                  {rememberMe && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <span>Remember me</span>
              </label>

              <button
                type="button"
                onClick={() => setForgotPasswordNotice((prev) => !prev)}
                className="font-semibold text-[#1d4ed8] transition-colors hover:text-[#1e3a8a] hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            {/* Forgot Password Institutional Info Notice */}
            {forgotPasswordNotice && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-[11px] leading-snug text-blue-900">
                Institutional password resets are managed by your SmartLib System
                Administrator (<span className="font-semibold">admin@smartlib.ac.in</span>).
              </div>
            )}

            {/* Auth Error Alert */}
            {authError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-medium leading-snug text-red-700"
              >
                {authError}
              </div>
            )}

            {/* Sign In Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 flex h-10 xl:h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0255d5] via-[#0c47b7] to-[#0a2351] px-5 text-sm xl:text-[15px] font-semibold text-white shadow-[0_6px_16px_rgba(2,85,213,0.3)] transition-all duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-3 xl:my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400">or</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* Browse Public OPAC Button */}
          <Link
            to="/opac"
            className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#93b4e8] bg-white px-4 text-xs sm:text-sm font-bold text-[#0f1f3d] transition-colors hover:border-[#1d4ed8] hover:bg-blue-50/60"
          >
            <BookOpen className="h-4 w-4 text-[#1d4ed8]" />
            <span>Browse Public OPAC</span>
          </Link>

          {/* Subtle Quick-Fill Evaluation Credentials Footer */}
          <div className="mt-3 xl:mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
            <span>Quick demo fill:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fillDemoCredentials("ADMIN")}
                className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#1d4ed8]"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials("LIBRARIAN")}
                className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 transition-colors hover:bg-blue-50 hover:text-[#1d4ed8]"
              >
                Librarian
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
