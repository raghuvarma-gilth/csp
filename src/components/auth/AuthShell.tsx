import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EduVerseBackground from "@/components/EduVerseBackground";

/**
 * The frame every page in the auth section sits in: background, back link,
 * brand, and the pitch panel shown beside the card on wide screens.
 *
 * It is deliberately dumb — it paints, it does not decide. Sign-in, the three
 * registration forms and the "check your email" screen differ only in what goes
 * inside the right-hand column, and they must not drift apart visually, which is
 * why the chrome lives in one place instead of four.
 */

const PROMISES = [
  {
    icon: Sparkles,
    title: "A tutor that reads your course",
    body: "Answers are grounded in published material. When the library does not cover something, it says so instead of inventing an answer.",
  },
  {
    icon: GraduationCap,
    title: "Practice aimed at what you got wrong",
    body: "Your weakest concepts come back first, and questions get harder only once you have earned it.",
  },
  {
    icon: ShieldCheck,
    title: "Progress you can check",
    body: "Every percentage on your dashboard is counted from attempts you actually made. Nothing here is decorative.",
  },
];

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <span className="inline-flex items-center gap-3">
    <span
      className={
        compact
          ? "gradient-primary shadow-primary flex h-10 w-10 items-center justify-center rounded-xl"
          : "gradient-primary shadow-primary flex h-11 w-11 items-center justify-center rounded-2xl"
      }
    >
      <Sparkles className="h-5 w-5 text-primary-foreground" aria-hidden />
    </span>
    <span className={compact ? "text-xl font-bold tracking-tight" : "text-2xl font-bold tracking-tight"}>
      EduVerse
    </span>
  </span>
);

interface AuthShellProps {
  /** The page title, used for the document title. */
  title: string;
  children: ReactNode;
}

const AuthShell = ({ title, children }: AuthShellProps) => (
  <div className="relative min-h-screen">
    <EduVerseBackground />

    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 lg:px-8">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
            Back to EduVerse
          </Link>
        </Button>
      </header>

      <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
        {/* ------------------------------------------------ left: the pitch */}
        <section className="hidden lg:block" aria-label="About EduVerse">
          <Brand />

          <h2 className="mt-8 max-w-md text-4xl font-bold leading-tight tracking-tight">
            Learn smarter.
            <br />
            <span className="text-gradient">Master faster.</span>
          </h2>

          <ul className="mt-8 max-w-md space-y-5">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex gap-3.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                  <promise.icon className="h-4 w-4 text-primary" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">{promise.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {promise.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------ right: the card */}
        <section className="w-full" aria-label={title}>
          {/* The brand again, for the narrow layout where the pitch is hidden. */}
          <div className="mb-6 flex items-center justify-center lg:hidden">
            <Brand compact />
          </div>

          {children}
        </section>
      </div>
    </div>
  </div>
);

export default AuthShell;

/** The card wrapper, so every page in the section has identical padding. */
export const AuthCard = ({ children }: { children: ReactNode }) => (
  <Card className="surface-card animate-rise">
    <CardContent className="p-7">{children}</CardContent>
  </Card>
);
