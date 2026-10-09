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
/* The three registration forms. They are separate routes rather than one page
   with a picker, so "register as a professor" is a link you can send someone. */
const RegisterStudent = lazy(() => import("./pages/auth/RegisterStudent"));
const RegisterFaculty = lazy(() => import("./pages/auth/RegisterFaculty"));
const RegisterIndustry = lazy(() => import("./pages/auth/RegisterIndustry"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Home = lazy(() => import("./pages/Home"));
const Learn = lazy(() => import("./pages/Learn"));
const Library = lazy(() => import("./pages/Library"));
const Updates = lazy(() => import("./pages/Updates"));
const ConceptPage = lazy(() => import("./pages/ConceptPage"));
const ModulePage = lazy(() => import("./pages/ModulePage"));
const Roadmap = lazy(() => import("./pages/Roadmap"));
const Practice = lazy(() => import("./pages/Practice"));
const Tutor = lazy(() => import("./pages/Tutor"));
const CodingLab = lazy(() => import("./pages/CodingLab"));
const CodingProblem = lazy(() => import("./pages/CodingProblem"));
const VisualLearning = lazy(() => import("./pages/VisualLearning"));
const VisualLab = lazy(() => import("./pages/VisualLab"));
const FocusSession = lazy(() => import("./pages/FocusSession"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const Achievements = lazy(() => import("./pages/Achievements"));
const Profile = lazy(() => import("./pages/Profile"));
const Diagnostic = lazy(() => import("./pages/Diagnostic"));
const RequestAccess = lazy(() => import("./pages/RequestAccess"));

const Faculty = lazy(() => import("./pages/Faculty"));
const Research = lazy(() => import("./pages/Research"));
const Industry = lazy(() => import("./pages/Industry"));
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
                {/* Registration: one form per kind of person. The bare path is the
                    student form, which is the common case and the default. Static
                    segments outrank the splat in React Router v6, so the two role
                    paths win over it and anything else — a mistyped or retired
                    role — bounces back to the student form rather than silently
                    rendering a form the person did not ask for. */}
                <Route path="/register" element={<RegisterStudent />} />
                <Route path="/register/faculty" element={<RegisterFaculty />} />
                <Route path="/register/industry" element={<RegisterIndustry />} />
                <Route path="/register/*" element={<Navigate to="/register" replace />} />

                {/* Student experience */}
                <Route element={<ShellLayout />}>
                  <Route path="/home" element={<Home />} />
                  <Route path="/learn" element={<Learn />} />
                  <Route path="/learn/:conceptSlug" element={<ConceptPage />} />
                  {/* Modules sit one level deeper because chapter slugs are only
                      unique within a course — the course slug is part of the
                      address, not decoration. */}
                  <Route path="/learn/:courseSlug/:moduleSlug" element={<ModulePage />} />
                  {/* What faculty and industry contributors published, once a
                      reviewer approved it. Students only ever see 'published'. */}
                  <Route path="/library" element={<Library />} />
                  {/* Faculty announcements and open industry postings. Both read
                      a SECURITY DEFINER function that filters on 'published'
                      and drops anything expired, so a count here is a count of
                      rows a student can actually act on. */}
                  <Route path="/updates" element={<Updates />} />
                  <Route path="/roadmap" element={<Roadmap />} />
                  <Route path="/practice" element={<Practice />} />
                  <Route path="/practice/:conceptSlug" element={<Practice />} />
                  <Route path="/tutor" element={<Tutor />} />
                  <Route path="/code" element={<CodingLab />} />
                  <Route path="/code/:problemSlug" element={<CodingProblem />} />
                  <Route path="/visual" element={<VisualLearning />} />
                  {/* Static segments outrank dynamic ones in React Router v6, so
                      `/visual/lab` wins over `/visual/:visualKey` whichever order
                      these are declared in — but keeping it first says so. */}
                  <Route path="/visual/lab" element={<VisualLab />} />
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
                {/* Authoring, for everyone allowed to author — and faculty, who
                    are the reviewers. Faculty were previously locked out of the
                    only screen where research is approved, so nothing submitted
                    here could ever reach a student. Authoring versus signing off
                    is decided inside the page and again in RLS, not by this
                    guard. */}
                <Route
                  element={
                    <ShellLayout
                      allow={["faculty", "research_expert", "industry_expert", "admin"]}
                    />
                  }
                >
                  <Route path="/research" element={<Research />} />
                </Route>
                {/* Posting opportunities. Faculty are deliberately absent: they
                    review these in the faculty workspace's queue but do not
                    author them, which is what the server's AUTHORS map says.
                    Administrators are in because every require_role check ORs
                    them in anyway. */}
                <Route element={<ShellLayout allow={["industry_expert", "admin"]} />}>
                  <Route path="/industry" element={<Industry />} />
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
                <Route path="/industry-dashboard" element={<Navigate to="/industry" replace />} />

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
