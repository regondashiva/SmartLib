import { Link, useLocation } from "react-router-dom";
import { ShieldAlert, LogIn, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const state = (location.state as { requiredRoles?: string[]; attemptedPath?: string } | null) ?? null;

  const requiredRoles = state?.requiredRoles ?? ["ADMIN"];
  const attemptedPath = state?.attemptedPath ?? location.pathname;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-lg overflow-hidden border-slate-200 shadow-xl">
        <div className="bg-[#071B3A] p-6 text-center text-white">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-8 ring-white/5">
            <ShieldAlert className="size-7 text-amber-400" />
          </div>
          <h1 className="mt-4 text-xl font-bold tracking-tight">Institutional Authorization Required</h1>
          <p className="mt-1 text-xs text-slate-300">
            RBAC security policy restricts access to administrative resources
          </p>
        </div>

        <CardContent className="space-y-5 p-6 text-sm">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Requested Route:</span>
              <code className="font-mono font-semibold text-[#0F172A]">{attemptedPath}</code>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Required Role:</span>
              <span className="rounded-md bg-blue-100 px-2 py-0.5 font-semibold text-blue-800">
                {requiredRoles.join(" or ")}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Your Current Role:</span>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">
                {user?.role ?? "Guest / Unauthenticated"}
              </span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-600">
            Access to this compliance audit trail and administrative console is strictly restricted to users with the{" "}
            <strong className="text-[#0F172A]">ADMIN</strong> role to ensure regulatory data privacy and non-repudiation.
          </p>

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <ArrowLeft className="size-3.5" />
                Return to Dashboard
              </Link>
            </Button>
            <Button
              size="sm"
              className="bg-[#2563EB] hover:bg-[#1D4ED8]"
              onClick={() => logout()}
            >
              <LogIn className="size-3.5" />
              Sign In as Administrator
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
