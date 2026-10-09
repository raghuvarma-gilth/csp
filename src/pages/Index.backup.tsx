import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  BarChart3,
  Binary,
  BookOpen,
  Bot,
  ClipboardCheck,
  Code2,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import ThemeToggle from "@/components/ThemeToggle";
import EduVerseBackground from "@/components/EduVerseBackground";

/**
 * The landing page.
 *
 * What it says here has to be true of the build it is sitting in front of, so
 * there are no numbers on this page. The prototype claimed "10K+ Active
 * Learners", "95% Success Rate" and "24/7 AI Support" — three figures no query
 * produced and nobody could have checked. Counts belong on the dashboard, where
 * they come from the database and are the reader's own.
 *
 * Every tile below links to a route that exists and a feature that is built.
 * The tone classes are written out in full rather than composed as
 * `bg-${colour}/10`: Tailwind scans source text, so an interpolated class name
 * is never in the stylesheet and silently renders as nothing.
 */

interface Feature {
  icon: typeof Bot;
  title: string;
  body: string;
  href: string;
  /** Written out in full — see the note above about Tailwind and interpolation. */
  tone: string;
}

const FEATURES: Feature[] = [
  {
    icon: ClipboardCheck,
    title: "Adaptive diagnostic",
    body: "A short test that changes as you answer it. It finds the concepts you are shaky on rather than the ones you happen to be asked about.",
    href: "/diagnostic",
    tone: "border-primary/25 bg-primary/10 text-primary",
  },
  {
    icon: MapIcon,
    title: "A roadmap built from that",
    body: "Your next step is chosen from what you have mastered, what you have forgotten, and what the curriculum says has to come first.",
    href: "/roadmap",
    tone: "border-accent/25 bg-accent/10 text-accent",
  },
  {
    icon: Bot,
    title: "A tutor that reads your course",
    body: "AIVA answers from published course material and cites the concept it used. Where the library is silent, it says so instead of inventing an answer.",
    href: "/tutor",
    tone: "border-info/25 bg-info/10 text-info",
  },
  {
    icon: Target,
    title: "Practice that targets weak spots",
    body: "Questions are drawn from your weakest concepts first. Wrong answers are read for the misconception behind them, not just marked.",
    href: "/practice",
    tone: "border-warning/25 bg-warning/10 text-warning",
  },
  {
    icon: Code2,
    title: "Coding lab with a real grader",
    body: "Write a solution and it is executed against the problem's test cases. Failures come back with the case that broke, not a guess.",
    href: "/code",
    tone: "border-primary/25 bg-primary/10 text-primary",
  },
  {
    icon: Binary,
    title: "Visual data structures",
    body: "Step through sorting, searching and traversal one operation at a time, forwards or back, at your own pace.",
    href: "/visual",
    tone: "border-accent/25 bg-accent/10 text-accent",
  },
  {
    icon: Timer,
    title: "Focus sessions",
    body: "A timer that measures whether the tab was actually in front of you. Real minutes, honestly counted — no camera, no mood scores.",
    href: "/focus",
    tone: "border-info/25 bg-info/10 text-info",
  },
  {
    icon: BarChart3,
    title: "Progress per concept",
    body: "Mastery is tracked concept by concept and decays if you leave something alone. Every figure is counted from attempts you made.",
    href: "/progress",
    tone: "border-success/25 bg-success/10 text-success",
  },
];

const STEPS = [
  {
    label: "Diagnose",
    body: "Sit a short adaptive test. It ends when it knows where you stand, not after a fixed number of questions.",
  },
  {
    label: "Learn",
    body: "Work through the concept your roadmap puts first, with a tutor that has read the same material you have.",
  },
  {
    label: "Practise",
    body: "Answer questions pitched at your current level. Each attempt updates the concept it belongs to.",
  },
  {
    label: "Measure",
    body: "Watch mastery move. Concepts you have not touched in a while come back before you lose them.",
  },
];

const Index = () => {
  const { user, isLoading } = useAuth();

  return (
    <div className="relative min-h-screen">
      <Helmet>
        <title>EduVerse — Learn Smarter. Master Faster.</title>
        <meta
          name="description"
          content="EduVerse finds the concepts you are weak on, teaches them, and measures whether it worked. Adaptive diagnostics, a tutor grounded in your course material, and progress tracked concept by concept."
        />
      </Helmet>

      <EduVerseBackground />

      {/* ------------------------------------------------------------ header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link to="/" className="group flex items-center gap-2.5">
            <span className="gradient-primary shadow-primary flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <Sparkles className="h-4 w-4 text-primary-foreground" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">EduVerse</span>
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isLoading ? (
              <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden />
            ) : user ? (
              <Button size="sm" asChild className="gradient-primary shadow-primary text-primary-foreground">
                <Link to="/home">
                  Go to dashboard
                  <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button size="sm" asChild className="gradient-primary shadow-primary text-primary-foreground">
                  <Link to="/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------------- hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Adaptive learning, grounded in your own course material
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
            Learn Smarter.
            <br />
            <span className="text-gradient">Master Faster.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            EduVerse works out which concepts you are weak on, teaches those first, and keeps
            checking whether it worked. One path, one record of what you know — not a folder of
            disconnected AI demos.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="gradient-primary shadow-primary h-12 px-7 text-primary-foreground">
              <Link to={user ? "/home" : "/register"}>
                {user ? "Continue learning" : "Start with a diagnostic"}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-7">
              <Link to={user ? "/learn" : "/auth"}>
                <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                Browse the curriculum
              </Link>
            </Button>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            Free to use with your institution's account. Every new account starts as a student.
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- how it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How a week on EduVerse goes</h2>
          <p className="mt-3 text-muted-foreground">
            The same four things, in a loop, for every concept in your course.
          </p>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.label} className="surface-card relative p-5">
              <span className="gradient-primary absolute -top-3 left-5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-primary-foreground">
                {index + 1}
              </span>
              <h3 className="mt-2 text-base font-semibold">{step.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------------------------------------------------- features */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One system, <span className="text-gradient">eight ways in</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            They all write to the same record of what you know, so nothing you do here is wasted on
            a screen that forgets it.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <Link key={feature.title} to={user ? feature.href : "/auth"} className="group">
              <Card className="surface-card h-full transition-all duration-200 hover:-translate-y-1 hover:border-primary/30">
                <CardContent className="p-5">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${feature.tone}`}
                  >
                    <feature.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3.5 text-base font-semibold transition-colors group-hover:text-primary">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------- honesty */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <Card className="surface-card border-primary/20">
          <CardContent className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_1.2fr] lg:gap-12">
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-primary/25 bg-primary/10">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight">
                Nothing on your dashboard is decorative
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Learning tools are easy to fake and hard to trust. These are the rules this one is
                built to, and they are enforced on the server rather than promised in a paragraph.
              </p>
            </div>

            <ul className="space-y-4 text-sm leading-relaxed">
              <li className="flex gap-3">
                <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">Every number is counted.</span> Streaks, mastery
                  and accuracy come from rows in the database. There are no sample figures anywhere
                  in this product — including on this page.
                </span>
              </li>
              <li className="flex gap-3">
                <Bot className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">The AI says when it does not know.</span> Answers
                  are retrieved from published course material and cite it. If the tutor is not
                  configured, you get a clear message — never a fabricated reply.
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">Course material is reviewed before you see it.</span>{" "}
                  Everything passes draft → submitted → approved → published, and nobody signs off
                  their own work. Students read only what has been published.
                </span>
              </li>
              <li className="flex gap-3">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">No inferred emotions.</span> Focus is measured
                  from whether the page was actually in front of you. Your camera is never used and
                  no wellbeing score is guessed at.
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* --------------------------------------------------------------- cta */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Trophy className="mx-auto h-8 w-8 text-primary" aria-hidden />
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Find out what you actually know
          </h2>
          <p className="mt-3 text-muted-foreground">
            The diagnostic takes a few minutes and sets up everything else.
          </p>
          <Button
            asChild
            size="lg"
            className="gradient-primary shadow-primary mt-7 h-12 px-8 text-primary-foreground"
          >
            <Link to={user ? "/diagnostic" : "/register"}>
              {user ? "Take the diagnostic" : "Create your account"}
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      {/* ------------------------------------------------------------ footer */}
      <footer className="border-t border-border/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="gradient-primary flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles className="h-4 w-4 text-primary-foreground" aria-hidden />
            </span>
            <span className="text-sm font-semibold">EduVerse</span>
          </div>
          <p className="text-center text-xs text-muted-foreground sm:text-right">
            An adaptive learning platform. Built to be checked, not just believed.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
