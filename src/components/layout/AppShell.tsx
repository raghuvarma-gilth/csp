import { ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Boxes,
  Briefcase,
  Code2,
  FlaskConical,
  GraduationCap,
  House,
  Library,
  LogOut,
  Megaphone,
  Menu,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  Trophy,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import ThemeToggle from "@/components/ThemeToggle";
import { EduVerseBackground } from "@/components/EduVerseBackground";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole, dashboardFor, ROLE_NAME, type AppRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

/**
 * One shell, one navigation per role.
 *
 * The prototype had four dashboards with four navigations and no relationship
 * between them, so "where am I" had four answers. The shell is shared now — the
 * header, the background, the theme, the sign-out — but the rail inside it is
 * the person's job. A professor has no use for a day streak and an industry
 * professional has no use for a placement check, and a rail that lists them
 * anyway is a rail nobody reads.
 *
 * The rail is drawn from the role the *server* resolved. Until that round trip
 * returns there is no rail: showing the student one and swapping it a moment
 * later would tell three of the five roles something false, briefly, every time
 * they load a page. It is also not a permission boundary — every destination
 * here is guarded again by ProtectedRoute and by RLS on the queries behind it.
 */

interface NavItem {
  to: string;
  label: string;
  icon: typeof BookOpen;
  end?: boolean;
}

/** Every destination in the product, named once. */
/**
 * One glyph per destination, and each one the glyph its own page already uses —
 * `/visual` draws Boxes, `/roadmap` draws Route, `/achievements` draws Trophy,
 * so arriving somewhere confirms the thing you clicked rather than introducing
 * a second symbol for it. None of these repeat a metric icon from
 * METRIC_ICON in learning/primitives: Timer here is a focus session, which is
 * why time-on-task over there is a Clock, and Target here is targeted practice
 * rather than anything that has been achieved.
 */
const NAV = {
  home: { to: "/home", label: "Home", icon: House, end: true },
  learn: { to: "/learn", label: "Learn", icon: BookOpen },
  updates: { to: "/updates", label: "Updates", icon: Megaphone },
  library: { to: "/library", label: "Contributions", icon: Library },
  roadmap: { to: "/roadmap", label: "Roadmap", icon: Route },
  practice: { to: "/practice", label: "Practice", icon: Target },
  tutor: { to: "/tutor", label: "AI Tutor", icon: Sparkles },
  code: { to: "/code", label: "Coding Lab", icon: Code2 },
  visual: { to: "/visual", label: "Visual Learning", icon: Boxes },
  focus: { to: "/focus", label: "Focus", icon: Timer },
  progress: { to: "/progress", label: "Progress", icon: TrendingUp },
  achievements: { to: "/achievements", label: "Achievements", icon: Trophy },
  faculty: { to: "/faculty", label: "Workspace", icon: GraduationCap, end: true },
  research: { to: "/research", label: "Research", icon: FlaskConical },
  industry: { to: "/industry", label: "Opportunities", icon: Briefcase },
  admin: { to: "/admin", label: "Administration", icon: ShieldCheck, end: true },
} satisfies Record<string, NavItem>;

/**
 * One rail per role, each starting at that role's own dashboard.
 *
 * Staff rails keep Learn and Contributions — a reviewer needs to see the thing
 * they are signing off as a student will — and drop Practice, Focus, Progress,
 * Achievements and the placement check, which measure a student's own work and
 * have nothing to measure for anybody else.
 *
 * Faculty appear under Research because they are its reviewers, not because
 * they author there; the page itself decides which buttons they get. Industry
 * accounts appear there for the same reason in reverse — they author research
 * but review nothing.
 */
const RAIL: Record<AppRole, NavItem[]> = {
  student: [
    NAV.home,
    NAV.learn,
    NAV.updates,
    NAV.library,
    NAV.roadmap,
    NAV.practice,
    NAV.tutor,
    NAV.code,
    NAV.visual,
    NAV.focus,
    NAV.progress,
    NAV.achievements,
  ],
  faculty: [NAV.faculty, NAV.research, NAV.learn, NAV.library, NAV.visual],
  research_expert: [NAV.research, NAV.learn, NAV.library],
  industry_expert: [NAV.industry, NAV.research, NAV.library, NAV.learn],
  admin: [NAV.admin, NAV.faculty, NAV.research, NAV.industry, NAV.learn, NAV.library],
};

const NavRail = ({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) => (
  <nav className="flex flex-col gap-1" aria-label="Main">
    {items.map(({ to, label, icon: Icon, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-primary/12 text-primary shadow-primary"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const { role, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = role ? RAIL[role] : [];
  const landing = dashboardFor(role);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split("@")[0] ?? "there";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const sidebarContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4">
      {roleLoading ? (
        <div className="flex flex-col gap-2" aria-label="Loading navigation">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 rounded-xl" />
          ))}
        </div>
      ) : (
        <NavRail items={items} onNavigate={onNavigate} />
      )}
      <Separator />
      <NavRail items={[{ to: "/profile", label: "Profile", icon: UserIcon }]} onNavigate={onNavigate} />
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <EduVerseBackground />

      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/65 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="border-b border-border px-4 py-4">
                <Link to={landing} className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
                    <GraduationCap className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-base font-bold">EduVerse</span>
                </Link>
              </div>
              <div className="overflow-y-auto p-3">{sidebarContent(() => setMobileOpen(false))}</div>
            </SheetContent>
          </Sheet>

          {/* The mark goes to the signed-in person's own dashboard. Sending
              everybody to /home would bounce the three staff roles straight
              back out again. */}
          <Link to={landing} className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-primary">
              <GraduationCap className="h-4 w-4" aria-hidden />
            </span>
            <span className="text-base font-bold tracking-tight">EduVerse</span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/profile" className="gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[10rem] truncate">{displayName}</span>
                {role && role !== "student" ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent">
                    {ROLE_NAME[role]}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px]">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border/70 px-3 py-4 lg:block">
          {sidebarContent()}
        </aside>

        <main key={location.pathname} className="min-w-0 flex-1 animate-fade-in px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
