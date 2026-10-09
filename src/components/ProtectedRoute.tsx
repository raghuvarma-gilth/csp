import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppRole, ROLE_NAME, dashboardFor, useUserRole } from "@/hooks/useUserRole";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  /** When set, the server-resolved role must be one of these. */
  allow?: AppRole[];
}

const FullPageSpinner = ({ label }: { label: string }) => (
  <div className="flex min-h-screen items-center justify-center" role="status" aria-live="polite">
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  </div>
);

/**
 * Gate for authenticated routes. The role check is advisory for UX only — the
 * database enforces the same boundary through RLS, so a user who edits their
 * client state gains nothing but a blank page.
 */
export const ProtectedRoute = ({ children, allow }: ProtectedRouteProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const location = useLocation();

  if (authLoading) return <FullPageSpinner label="Checking your session…" />;

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }

  if (!allow) return <>{children}</>;

  if (roleLoading) return <FullPageSpinner label="Confirming your access…" />;

  if (!role || !allow.includes(role)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">This area needs different access</h1>
          <p className="text-sm text-muted-foreground">
            Your account is signed in as <strong>{role ? ROLE_NAME[role] : "unknown"}</strong>.
            Faculty, research and industry areas are granted by an administrator approving a request
            — they cannot be self-assigned, here or anywhere else in the product.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild variant="outline">
              <Link to={dashboardFor(role)}>Back to your dashboard</Link>
            </Button>
            <Button asChild>
              <Link to="/request-access">Request access</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
