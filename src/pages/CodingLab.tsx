import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Code2, Search, Terminal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurriculum } from "@/hooks/useLearning";
import { useApiHealth } from "@/hooks/useApiHealth";
import { PageHeader } from "@/components/learning/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { cn } from "@/lib/utils";

/**
 * Coding Lab — the published problem set.
 *
 * "Solved" here means a submission whose tests all passed when the server ran
 * them. It is not a self-reported checkbox and not a heuristic on code length.
 *
 * The languages the server can actually execute are read from `/api/health`. If
 * execution is switched off the page says so up front rather than letting a
 * student write a solution and discover at Run time that nothing happens.
 */

const DIFFICULTY: Record<number, { label: string; className: string }> = {
  1: { label: "Easy", className: "text-success border-success/40" },
  2: { label: "Easy", className: "text-success border-success/40" },
  3: { label: "Medium", className: "text-warning border-warning/40" },
  4: { label: "Hard", className: "text-destructive border-destructive/40" },
  5: { label: "Hard", className: "text-destructive border-destructive/40" },
};

const CodingLab = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const curriculum = useCurriculum();
  const health = useApiHealth();

  const problems = useQuery({
    queryKey: ["coding-problems"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coding_problems")
        .select("id, slug, title, prompt, difficulty, concept_id, expected_complexity")
        .eq("status", "published")
        .order("difficulty");
      if (error) throw error;
      return data ?? [];
    },
  });

  const solved = useQuery({
    queryKey: ["coding-solved", user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coding_attempts")
        .select("problem_id, is_solved")
        .eq("user_id", user!.id)
        .eq("is_solved", true);
      if (error) throw error;
      return new Set((data ?? []).map((row) => row.problem_id));
    },
  });

  const conceptTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const course of curriculum.data ?? []) {
      for (const chapter of course.chapters) {
        for (const concept of chapter.concepts) map.set(concept.id, concept.title);
      }
    }
    return map;
  }, [curriculum.data]);

  if (problems.isLoading) return <LoadingState label="Loading problems…" />;
  if (problems.error) return <ErrorState error={problems.error} onRetry={() => void problems.refetch()} />;

  const needle = query.trim().toLowerCase();
  const filtered = (problems.data ?? []).filter(
    (problem) => !needle || problem.title.toLowerCase().includes(needle),
  );
  const solvedCount = (problems.data ?? []).filter((problem) => solved.data?.has(problem.id)).length;
  const runnable = health.data?.runnableLanguages ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Coding Lab"
        title="Talk2Code"
        description="Work a problem the way an interviewer would ask you to: state the approach, sketch it, write it, then justify the complexity. Your code runs on the server against real test cases."
      />

      {(problems.data ?? []).length === 0 ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <EmptyState
              icon={<Code2 className="h-8 w-8" aria-hidden />}
              title="No problems published yet"
              description="Coding problems are authored by faculty and published through review. None have been yet."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to="/learn">Browse the curriculum</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search problems…"
                className="pl-9"
                aria-label="Search problems"
              />
            </div>
            <Badge variant="secondary">
              {solvedCount} / {(problems.data ?? []).length} solved
            </Badge>
            {health.data ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" aria-hidden />
                {runnable.length > 0
                  ? `Runs ${runnable.join(" and ")} on the server`
                  : "Execution is off on this server — the mentor and hints still work"}
              </span>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <Card className="surface-card">
              <CardContent className="p-0">
                <EmptyState
                  icon={<Search className="h-8 w-8" aria-hidden />}
                  title="No problem matches that"
                  description={`Nothing published is called “${query.trim()}”.`}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((problem) => {
                const isSolved = solved.data?.has(problem.id) ?? false;
                const difficulty = DIFFICULTY[problem.difficulty] ?? {
                  label: `L${problem.difficulty}`,
                  className: "",
                };

                return (
                  <Link key={problem.id} to={`/code/${problem.slug}`} className="group">
                    <Card
                      className={cn(
                        "surface-card h-full transition-shadow group-hover:shadow-md",
                        isSolved && "border-success/40",
                      )}
                    >
                      <CardContent className="flex h-full flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold leading-snug">{problem.title}</h3>
                          {isSolved ? (
                            <span
                              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                              title="All tests passed"
                            >
                              <Check className="h-3 w-3" aria-hidden />
                            </span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {problem.prompt}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                          <Badge variant="outline" className={cn("text-[10px]", difficulty.className)}>
                            {difficulty.label}
                          </Badge>
                          {problem.concept_id && conceptTitles.has(problem.concept_id) ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {conceptTitles.get(problem.concept_id)}
                            </Badge>
                          ) : null}
                          {problem.expected_complexity ? (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {problem.expected_complexity}
                            </span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CodingLab;
