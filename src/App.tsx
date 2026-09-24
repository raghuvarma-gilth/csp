import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UserRoleProvider } from "@/hooks/useUserRole";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import RouteSeo from "@/components/RouteSeo";
import { LoadingState } from "@/components/states";

/**
 * One route table for the whole product.
 *
 * The prototype shipped four parallel "learning" sections (/dashboard,
 * /student-dashboard, /adaptive-learning, /learnflow) that each told a student
 * something different about the same progress, and none of them were guarded —
 * every page was reachable while signed out. Here there is a single canonical
 * path per capability, every signed-in path sits behind ProtectedRoute inside
 * the shared shell, and the old paths redirect instead of 404ing so existing
 * links keep working.
 *
 * Every page is lazily imported: the landing page should not pay for the code
 * editor, the 3D viewer or the visualiser.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30 * 1000,
    },
  },
});

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const Home = lazy(() => import("./pages/Home"));
const Learn = lazy(() => import("./pages/Learn"));
const ConceptPage = lazy(() => import("./pages/ConceptPage"));
const ModulePage = lazy(() => import("./pages/ModulePage"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Practice = lazy(() => import("./pages/Practice"));
const Tutor = lazy(() => import("./pages/Tutor"));
const CodingLab = lazy(() => import("./pages/CodingLab"));
const CodingProblem = lazy(() => import("./pages/CodingProblem"));
const VisualLearning = lazy(() => import("./pages/VisualLearning"));
const FocusSession = lazy(() => import("./pages/FocusSession"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Profile = lazy(() => import("./pages/Profile"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const RequestAccess = lazy(() => import("./pages/RequestAccess"));

const Faculty = lazy(() => import("./pages/Faculty"));
const Research = lazy(() => import("./pages/Research"));
const Admin = lazy(() => import("./pages/Admin"));

const PageFallback = () => <LoadingState label="Loading page…" className="py-24" />;

/** Signed-in layout: guard, shell, then the page. */
const ShellLayout = ({ allow }: { allow?: Parameters<typeof ProtectedRoute>[0]["allow"] }) => (
  <ProtectedRoute allow={allow}>
    <AppShell>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </AppShell>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserRoleProvider>
        <TooltipProvider delayDuration={200}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteSeo />
            <Suspense fallback={<PageFallback />}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />

                {/* Student experience */}
                <Route element={<ShellLayout />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/learn" element={<Learn />} />
                  <Route path="/learn/:conceptSlug" element={<ConceptPage />} />
                  {/* Modules sit one level deeper because chapter slugs are only
                      unique within a course — the course slug is part of the
                      address, not decoration. */}
                  <Route path="/learn/:courseSlug/:moduleSlug" element={<ModulePage />} />
                  <Route path="/roadmap" element={<Roadmap />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/practice/:conceptSlug" element={<Practice />} />
                  <Route path="/tutor" element={<Tutor />} />
                  <Route path="/code" element={<CodingLab />} />
                  <Route path="/code/:problemSlug" element={<CodingProblem />} />
                  <Route path="/visual" element={<VisualLearning />} />
                  <Route path="/visual/:visualKey" element={<VisualLearning />} />
                  <Route path="/focus" element={<FocusSession />} />
                  <Route path="/progress" element={<ProgressPage />} />
                  <Route path="/achievements" element={<Achievements />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/diagnostic" element={<Diagnostic />} />
                  <Route path="/request-access" element={<RequestAccess />} />
                </Route>

                {/* Staff areas. These roles are granted by an administrator;
                    the guard is enforced again by RLS on every query. */}
                <Route element={<ShellLayout allow={["faculty", "admin"]} />}>
                  <Route path="/faculty" element={<Faculty />} />
                </Route>
                <Route element={<ShellLayout allow={["research_expert", "admin"]} />}>
                  <Route path="/research" element={<Research />} />
                </Route>
                <Route element={<ShellLayout allow={["admin"]} />}>
                  <Route path="/admin" element={<Admin />} />
                </Route>

                {/* Retired paths from the prototype. */}
                <Route path="/dashboard" element={<Navigate to="/home" replace />} />
                <Route path="/student-dashboard" element={<Navigate to="/home" replace />} />
                <Route path="/adaptive-learning" element={<Navigate to="/roadmap" replace />} />
                <Route path="/learnflow" element={<Navigate to="/learn" replace />} />
                <Route path="/talk2code" element={<Navigate to="/code" replace />} />
                <Route path="/ar-learning" element={<Navigate to="/visual" replace />} />
                <Route path="/mindpulse" element={<Navigate to="/focus" replace />} />
                <Route path="/progress-board" element={<Navigate to="/progress" replace />} />
                <Route path="/select-role" element={<Navigate to="/request-access" replace />} />
                <Route path="/faculty-dashboard" element={<Navigate to="/faculty" replace />} />
                <Route path="/research-dashboard" element={<Navigate to="/research" replace />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </UserRoleProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
