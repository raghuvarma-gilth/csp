import { ReactNode, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  Brain,
  Code2,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import ThemeToggle from "@/components/ThemeToggle";
import { EduVerseBackground } from "@/components/EduVerseBackground";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

/**
 * One shell for every signed-in surface.
 *
 * The prototype had four different dashboards with four different navigations,
 * so "where am I" had four answers. There is one now: the same rail, the same
 * order, on every page.
 */

interface NavItem {
  to: string;
  label: string;
  icon: typeof BookOpen;
  end?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { to: "/home", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/roadmap", label: "Roadmap", icon: MapIcon },
  { to: "/practice", label: "Practice", icon: Target },
  { to: "/tutor", label: "AI Tutor", icon: Sparkles },
  { to: "/code", label: "Coding Lab", icon: Code2 },
  { to: "/visual", label: "Visual Learning", icon: Brain },
  { to: "/focus", label: "Focus", icon: Timer },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/achievements", label: "Achievements", icon: Award },
];

const STAFF_NAV = {
  faculty: { to: "/faculty", label: "Faculty", icon: GraduationCap },
  research: { to: "/research", label: "Research", icon: FlaskConical },
  admin: { to: "/admin", label: "Admin", icon: ShieldCheck },
} as const;

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
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
  const { role, isFaculty, isResearchExpert, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const staffItems: NavItem[] = [
    ...(isFaculty ? [STAFF_NAV.faculty] : []),
    ...(isResearchExpert ? [STAFF_NAV.research] : []),
    ...(isAdmin ? [STAFF_NAV.admin] : []),
  ];

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split("@")[0] ?? "Student";

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const sidebarContent = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4">
      <NavRail items={STUDENT_NAV} onNavigate={onNavigate} />
      {staffItems.length > 0 ? (
        <>
          <Separator />
          <div>
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Staff
            </p>
            <NavRail items={staffItems} onNavigate={onNavigate} />
          </div>
        </>
      ) : null}
      <Separator />
      <NavRail items={[{ to: "/profile", label: "Profile", icon: UserIcon }]} onNavigate={onNavigate} />
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <EduVerseBackground />

      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
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
                <Link to="/home" className="flex items-center gap-2" onClick={() => setMobileOpen(false)}>
                  <span className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
                    <GraduationCap className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-base font-bold">EduVerse</span>
                </Link>
              </div>
              <div className="overflow-y-auto p-3">{sidebarContent(() => setMobileOpen(false))}</div>
            </SheetContent>
          </Sheet>

          <Link to="/home" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
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
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                    {role.replace("_", " ")}
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
