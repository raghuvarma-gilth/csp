import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CheckCircle2,
  Code2,
  FlaskConical,
  GraduationCap,
  Layers,
  LineChart,
  Presentation,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import RegisterForm from "@/components/auth/RegisterForm";
import {
  FACULTY_COPY,
  INDUSTRY_COPY,
  STUDENT_COPY,
  type IntentCopy,
} from "@/components/auth/credentials";

/* ========================================================================== */
/* Role visual identity                                                        */
/* ========================================================================== */

/**
 * Each role gets a distinct visual identity — not just different copy but a
 * different colour accent, icon set, set of promises, and background pattern.
 * The intent is that somebody landing on `/register/faculty` immediately knows
 * they are in the right place without reading a word.
 */

interface RoleTheme {
  /** The main icon in the hero area. */
  heroIcon: LucideIcon;
  /** CSS gradient for the hero icon badge. */
  gradient: string;
  /** CSS gradient for the CTA button. */
  buttonGradient: string;
  /** Subtle glow colour for the background. */
  glowFrom: string;
  glowTo: string;
  /** Headline on the pitch panel. */
  headline: ReactNode;
  /** Tagline under the headline. */
  tagline: string;
  /** The three promises shown on the pitch panel. */
  promises: Array<{ icon: LucideIcon; title: string; body: string }>;
  /** Floating background icons for visual texture. */
  floatingIcons: LucideIcon[];
  /** A short role badge label. */
  badge: string;
  /** Accent HSL for the badge ring. */
  accentHsl: string;
}

const STUDENT_THEME: RoleTheme = {
  heroIcon: GraduationCap,
  gradient: "linear-gradient(135deg, hsl(192 95% 35%), hsl(272 72% 55%))",
  buttonGradient: "linear-gradient(135deg, hsl(192 95% 30%), hsl(272 72% 48%))",
  glowFrom: "hsl(192 95% 35% / 0.12)",
  glowTo: "hsl(272 72% 55% / 0.08)",
  headline: (
    <>
      Start learning.
      <br />
      <span className="register-headline-accent register-headline-accent--student">
        Master everything.
      </span>
    </>
  ),
  tagline:
    "EduVerse adapts to you — it finds what you haven't mastered, teaches it, and proves the gap is closed.",
  promises: [
    {
      icon: Brain,
      title: "AI-powered personalisation",
      body: "Your learning path is built from your answers, not a syllabus someone assumed you need.",
    },
    {
      icon: Target,
      title: "Practice that targets weaknesses",
      body: "Questions get harder only after you earn it. Your weakest concepts always come back first.",
    },
    {
      icon: TrendingUp,
      title: "Track real progress",
      body: "Every number on your dashboard is counted from work you actually did. Nothing is decorative.",
    },
  ],
  floatingIcons: [BookOpen, Code2, Brain, Award, Zap, Layers],
  badge: "Student",
  accentHsl: "192 95% 35%",
};

const FACULTY_THEME: RoleTheme = {
  heroIcon: Presentation,
  gradient: "linear-gradient(135deg, hsl(152 65% 35%), hsl(192 88% 40%))",
  buttonGradient: "linear-gradient(135deg, hsl(152 65% 30%), hsl(192 88% 35%))",
  glowFrom: "hsl(152 65% 35% / 0.12)",
  glowTo: "hsl(192 88% 40% / 0.08)",
  headline: (
    <>
      Shape the curriculum.
      <br />
      <span className="register-headline-accent register-headline-accent--faculty">
        Empower students.
      </span>
    </>
  ),
  tagline:
    "Author course material, post announcements, and review everything before students see it.",
  promises: [
    {
      icon: BookOpen,
      title: "Full curriculum authoring",
      body: "Create courses, chapters, concepts, and problems with a rich editor and a review pipeline.",
    },
    {
      icon: ShieldCheck,
      title: "Peer-reviewed publishing",
      body: "Nothing reaches a student without sign-off. Nobody approves their own work — the server enforces it.",
    },
    {
      icon: LineChart,
      title: "Student insight at a glance",
      body: "See which concepts are mastered and which are slipping across your cohort in real time.",
    },
  ],
  floatingIcons: [BookOpen, Users, FlaskConical, CheckCircle2, Sparkles, Layers],
  badge: "Faculty",
  accentHsl: "152 65% 35%",
};

const INDUSTRY_THEME: RoleTheme = {
  heroIcon: Briefcase,
  gradient: "linear-gradient(135deg, hsl(26 90% 45%), hsl(352 72% 55%))",
  buttonGradient: "linear-gradient(135deg, hsl(26 90% 38%), hsl(352 72% 48%))",
  glowFrom: "hsl(26 90% 45% / 0.12)",
  glowTo: "hsl(352 72% 55% / 0.08)",
  headline: (
    <>
      Bridge the gap.
      <br />
      <span className="register-headline-accent register-headline-accent--industry">
        Shape real careers.
      </span>
    </>
  ),
  tagline:
    "Contribute real-world applications, case studies, and industry opportunities alongside the curriculum.",
  promises: [
    {
      icon: Rocket,
      title: "Post opportunities directly",
      body: "Internships, jobs, projects, workshops — post them and they reach students after faculty review.",
    },
    {
      icon: FlaskConical,
      title: "Publish case studies",
      body: "Write about real work and real challenges. Your contributions sit next to the concepts they illustrate.",
    },
    {
      icon: Building2,
      title: "Build your talent pipeline",
      body: "Students who apply have already demonstrated mastery in the concepts your work needs.",
    },
  ],
  floatingIcons: [Briefcase, Rocket, Building2, TrendingUp, Zap, Users],
  badge: "Industry",
  accentHsl: "26 90% 45%",
};

const THEMES: Record<string, RoleTheme> = {
  student: STUDENT_THEME,
  faculty: FACULTY_THEME,
  industry_expert: INDUSTRY_THEME,
};

/* ========================================================================== */
/* Floating icons — decorative texture behind the pitch panel                  */
/* ========================================================================== */

const FLOAT_POSITIONS = [
  { top: "8%", left: "5%", delay: "0s", size: 28, opacity: 0.08 },
  { top: "18%", right: "8%", delay: "1.5s", size: 22, opacity: 0.06 },
  { top: "38%", left: "12%", delay: "3s", size: 32, opacity: 0.07 },
  { top: "55%", right: "15%", delay: "0.8s", size: 26, opacity: 0.05 },
  { top: "72%", left: "8%", delay: "2.2s", size: 24, opacity: 0.09 },
  { top: "85%", right: "5%", delay: "4s", size: 20, opacity: 0.06 },
];

const FloatingIcons = ({ icons }: { icons: LucideIcon[] }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    {icons.map((Icon, i) => {
      const pos = FLOAT_POSITIONS[i % FLOAT_POSITIONS.length];
      return (
        <div
          key={i}
          className="register-float-icon absolute"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            opacity: pos.opacity,
            animationDelay: pos.delay,
          }}
        >
          <Icon style={{ width: pos.size, height: pos.size }} />
        </div>
      );
    })}
  </div>
);

/* ========================================================================== */
/* Role badge — shown in the top-left of the card                              */
/* ========================================================================== */

const RoleBadge = ({ label, accentHsl }: { label: string; accentHsl: string }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider"
    style={{
      borderColor: `hsl(${accentHsl} / 0.35)`,
      background: `hsl(${accentHsl} / 0.08)`,
      color: `hsl(${accentHsl})`,
    }}
  >
    <span
      className="h-1.5 w-1.5 rounded-full"
      style={{ background: `hsl(${accentHsl})` }}
    />
    {label}
  </span>
);

/* ========================================================================== */
/* The layout                                                                  */
/* ========================================================================== */

interface RegisterLayoutProps {
  copy: IntentCopy;
}

/**
 * The shell for one registration form.
 *
 * `App.tsx` routes `/register`, `/register/faculty` and `/register/industry`
 * separately and renders this three times with different copy, rather than this
 * file matching the URL itself with a nested `<Routes>`. React Router v6 hands
 * each route one component; splitting the matching across two levels would mean
 * the outer route has to match `/register/*` and then re-match, which is the kind
 * of indirection that hides which form is actually on screen.
 *
 * The role is therefore still the URL — the three doors are separately linkable
 * and separately shareable — it is just resolved in `App.tsx`, where every other
 * route in the app is declared.
 *
 * There is no `<Helmet>` here. All three paths are listed in `RouteSeo`'s
 * `routeMeta`, which is what gives them a canonical tag and keeps them out of the
 * `noindex` fallback; adding a second title and description on the page would be
 * two strings to keep in step for one tag.
 */
const RegisterLayout = ({ copy }: RegisterLayoutProps) => {
  const theme = THEMES[copy.intent] ?? STUDENT_THEME;
  const HeroIcon = theme.heroIcon;

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden="true"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 20%, ${theme.glowFrom}, transparent 65%),
            radial-gradient(ellipse 60% 40% at 80% 80%, ${theme.glowTo}, transparent 60%)
          `,
        }}
      />

      {/* Dot grid texture */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.025]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, currentColor 0.5px, transparent 0.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              Back to EduVerse
            </Link>
          </Button>
          <RoleBadge label={theme.badge} accentHsl={theme.accentHsl} />
        </header>

        {/* Main grid */}
        <div className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-16">
          {/* Left: the pitch */}
          <section className="relative hidden lg:block" aria-label="About EduVerse">
            <FloatingIcons icons={theme.floatingIcons} />

            {/* Brand */}
            <Link to="/" className="group inline-flex items-center gap-3">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 group-hover:scale-105"
                style={{ background: theme.gradient }}
              >
                <Sparkles className="h-6 w-6 text-white" aria-hidden />
              </span>
              <span className="text-2xl font-bold tracking-tight">EduVerse</span>
            </Link>

            {/* Headline */}
            <h2 className="mt-8 max-w-lg text-4xl font-extrabold leading-[1.15] tracking-tight xl:text-5xl">
              {theme.headline}
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              {theme.tagline}
            </p>

            {/* Promises */}
            <ul className="mt-10 max-w-md space-y-6">
              {theme.promises.map((promise) => (
                <li key={promise.title} className="register-promise group flex gap-4">
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-colors duration-200"
                    style={{
                      borderColor: `hsl(${theme.accentHsl} / 0.25)`,
                      background: `hsl(${theme.accentHsl} / 0.08)`,
                    }}
                  >
                    <promise.icon
                      className="h-5 w-5"
                      style={{ color: `hsl(${theme.accentHsl})` }}
                      aria-hidden
                    />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{promise.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {promise.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {/* Hero icon: large, glowing, behind the content */}
            <div
              className="register-hero-icon pointer-events-none absolute -bottom-12 -right-8 opacity-[0.04]"
              aria-hidden="true"
            >
              <HeroIcon className="h-80 w-80" />
            </div>
          </section>

          {/* Right: the card */}
          <section className="w-full" aria-label={copy.heading}>
            {/* Mobile brand */}
            <div className="mb-6 flex flex-col items-center gap-3 lg:hidden">
              <Link to="/" className="inline-flex items-center gap-2">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md"
                  style={{ background: theme.gradient }}
                >
                  <Sparkles className="h-5 w-5 text-white" aria-hidden />
                </span>
                <span className="text-xl font-bold tracking-tight">EduVerse</span>
              </Link>
              <RoleBadge label={theme.badge} accentHsl={theme.accentHsl} />
            </div>

            {/* The card */}
            <Card className="register-card surface-card animate-rise overflow-hidden">
              {/* Coloured top accent bar */}
              <div className="h-1" style={{ background: theme.gradient }} aria-hidden="true" />
              <CardContent className="p-7">
                <RegisterForm copy={copy} />
              </CardContent>
            </Card>

            {/* Link to the other two doors */}
            <div className="mt-5">
              <p className="mb-2 text-center text-xs text-muted-foreground">
                Not a {theme.badge.toLowerCase()}?
              </p>
              <div className="flex justify-center gap-2">
                {copy.intent !== "student" && (
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link to="/register">
                      <GraduationCap className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Student
                    </Link>
                  </Button>
                )}
                {copy.intent !== "faculty" && (
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link to="/register/faculty">
                      <Presentation className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Faculty
                    </Link>
                  </Button>
                )}
                {copy.intent !== "industry_expert" && (
                  <Button asChild variant="ghost" size="sm" className="text-xs">
                    <Link to="/register/industry">
                      <Briefcase className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Industry
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default RegisterLayout;

export const StudentRegistration = () => <RegisterLayout copy={STUDENT_COPY} />;
export const FacultyRegistration = () => <RegisterLayout copy={FACULTY_COPY} />;
export const IndustryRegistration = () => <RegisterLayout copy={INDUSTRY_COPY} />;
