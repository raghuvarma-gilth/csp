import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BookMarked,
  Bot,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCurriculum, useRefreshLearningState } from "@/hooks/useLearning";
import { useFeature } from "@/hooks/useApiHealth";
import { PageHeader } from "@/components/learning/primitives";
import { Markdown } from "@/components/learning/Markdown";
import { ConfigNotice, ErrorState } from "@/components/states";
import { apiTarget, callFunction, getJson } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * AI Tutor — grounded conversation about published course material.
 *
 * Two things on this screen are deliberate and load-bearing:
 *
 *   * The "Grounded" badge is the server's own verdict, not decoration. When it
 *     is absent the reply was written from general knowledge, and the UI says so
 *     rather than letting every answer look equally authoritative.
 *   * When retrieval is unavailable — no Hugging Face key, corpus empty, service
 *     rate limited — the banner names it. The tutor does not silently answer
 *     course-specific questions as though it had the syllabus in front of it.
 *
 * There is no canned reply path anywhere in this file. If the model is not
 * configured the composer is disabled and the reason is shown.
 */

const MODES = [
  { value: "explain", label: "Explain", hint: "A clear walkthrough with one worked example." },
  { value: "socratic", label: "Socratic", hint: "One question at a time. No answers given." },
  { value: "hint", label: "Hint", hint: "The smallest nudge that unblocks you." },
  { value: "practice", label: "Practice", hint: "Poses a problem, then waits." },
  { value: "revision", label: "Revision", hint: "Compact summary plus a self-check." },
  { value: "exam", label: "Exam", hint: "Precise, structured, marking points explicit." },
] as const;

interface Source {
  title: string;
  heading: string | null;
  concept: string | null;
  similarity: number;
}

interface ChatResponse {
  conversationId: string;
  reply: string;
  grounded: boolean;
  retrievalUnavailable: boolean;
  sources: Source[];
  misconception: { statement: string; correction: string } | null;
}

interface Turn {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounded?: boolean;
  sources?: Source[];
}

const SUGGESTIONS = [
  "Explain this with a small example I can follow.",
  "Where do people usually go wrong here?",
  "Give me a hint — I don't want the answer yet.",
  "What would an exam answer for this look like?",
];

const Tutor = () => {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const curriculum = useCurriculum();
  const refreshLearningState = useRefreshLearningState();
  const tutor = useFeature("tutor");

  const [mode, setMode] = useState<string>("explain");
  const [conceptId, setConceptId] = useState<string>(params.get("concept") ?? "none");
  const [conversationId, setConversationId] = useState<string | null>(params.get("conversation"));
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [retrievalDown, setRetrievalDown] = useState(false);
  const [misconception, setMisconception] = useState<ChatResponse["misconception"]>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const concepts = useMemo(
    () =>
      (curriculum.data ?? [])
        .flatMap((course) => course.chapters)
        .flatMap((chapter) => chapter.concepts),
    [curriculum.data],
  );

  const conversations = useQuery({
    queryKey: ["conversations"],
    enabled: apiTarget === "python",
    queryFn: () =>
      getJson<{ conversations: Array<{ id: string; title: string; mode: string; updated_at: string }> }>(
        "conversations",
      ),
  });

  /** Replays a stored conversation into the thread. */
  const openConversation = useCallback(
    async (id: string) => {
      setConversationId(id);
      setMisconception(null);
      try {
        const data = await getJson<{
          conversation: { mode: string; concept_id: string | null };
          messages: Array<{ id: string; role: string; content: string; grounded: boolean; sources: Source[] | null }>;
        }>(`conversations/${id}`);
        setMode(data.conversation.mode ?? "explain");
        setConceptId(data.conversation.concept_id ?? "none");
        setTurns(
          data.messages
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              id: message.id,
              role: message.role as "user" | "assistant",
              content: message.content,
              grounded: message.grounded,
              sources: message.sources ?? [],
            })),
        );
      } catch {
        // The thread stays as it is; the send path surfaces any real failure.
      }
    },
    [],
  );

  useEffect(() => {
    const requested = params.get("conversation");
    if (requested && requested !== conversationId) void openConversation(requested);
    // Only reacts to an address change, not to local state moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  const send = useMutation({
    mutationFn: (message: string) =>
      callFunction<ChatResponse>("aiva-chat", {
        message,
        mode,
        conceptId: conceptId === "none" ? null : conceptId,
        conversationId,
      }),
    onSuccess: (data) => {
      setConversationId(data.conversationId);
      setRetrievalDown(data.retrievalUnavailable);
      setMisconception(data.misconception);
      setTurns((current) => [
        ...current,
        {
          id: `${data.conversationId}-${current.length}`,
          role: "assistant",
          content: data.reply,
          grounded: data.grounded,
          sources: data.sources,
        },
      ]);
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (data.misconception) refreshLearningState();
    },
  });

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || send.isPending) return;
    setTurns((current) => [...current, { id: `local-${current.length}`, role: "user", content: message }]);
    setDraft("");
    send.mutate(message);
  };

  const startNew = () => {
    setConversationId(null);
    setTurns([]);
    setMisconception(null);
    setRetrievalDown(false);
    const next = new URLSearchParams(params);
    next.delete("conversation");
    setParams(next, { replace: true });
  };

  const activeMode = MODES.find((item) => item.value === mode) ?? MODES[0];
  const activeConcept = concepts.find((concept) => concept.id === conceptId) ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI Tutor"
        title="AIVA"
        description="Answers are grounded in published course material where that material exists. Where it does not, the reply says so instead of inventing a syllabus."
        actions={
          <Button variant="outline" onClick={startNew} disabled={turns.length === 0 && !conversationId}>
            <MessageSquarePlus className="mr-2 h-4 w-4" aria-hidden />
            New conversation
          </Button>
        }
      />

      {tutor.available === false ? <ConfigNotice message={tutor.message ?? ""} /> : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Teaching mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={conceptId}
              onValueChange={(value) => {
                setConceptId(value);
                const next = new URLSearchParams(params);
                if (value === "none") next.delete("concept");
                else next.set("concept", value);
                setParams(next, { replace: true });
              }}
            >
              <SelectTrigger className="w-full sm:w-64" aria-label="Concept context">
                <SelectValue placeholder="No specific concept" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific concept</SelectItem>
                {concepts.map((concept) => (
                  <SelectItem key={concept.id} value={concept.id}>
                    {concept.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            {activeMode.hint}
            {activeConcept ? ` Context: ${activeConcept.title}.` : ""}
          </p>

          {retrievalDown ? (
            <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-xs leading-relaxed text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>
                Course-material retrieval is unavailable right now, so the last reply was not checked
                against your syllabus. Treat course-specific details in it with caution.
              </span>
            </div>
          ) : null}

          <Card className="surface-card">
            <CardContent className="p-0">
              <ScrollArea className="h-[52vh] min-h-[320px] p-4">
                {turns.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 py-10 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                      <Bot className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="max-w-sm space-y-1">
                      <p className="text-sm font-semibold">Ask about anything in the curriculum</p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        Pick a concept above to ground the answer in that lesson's material.
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => submit(suggestion)}
                          disabled={tutor.available === false}
                          className="rounded-full border border-border/70 px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/50 disabled:opacity-50"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {turns.map((turn) => (
                      <div
                        key={turn.id}
                        className={cn("flex gap-3", turn.role === "user" && "flex-row-reverse")}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                            turn.role === "user" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                          )}
                          aria-hidden
                        >
                          {turn.role === "user" ? (
                            <UserIcon className="h-3.5 w-3.5" />
                          ) : (
                            <Bot className="h-3.5 w-3.5" />
                          )}
                        </span>

                        <div
                          className={cn(
                            "min-w-0 max-w-[85%] rounded-2xl px-3.5 py-2.5",
                            turn.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "border border-border/60 bg-card",
                          )}
                        >
                          {turn.role === "user" ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{turn.content}</p>
                          ) : (
                            <>
                              <Markdown content={turn.content} />
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {turn.grounded ? (
                                  <Badge variant="secondary" className="gap-1 text-[10px] text-success">
                                    <ShieldCheck className="h-3 w-3" aria-hidden />
                                    Grounded in course material
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                    General knowledge — not from your syllabus
                                  </Badge>
                                )}
                              </div>
                              {(turn.sources ?? []).length > 0 ? (
                                <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                                  {(turn.sources ?? []).map((source, index) => (
                                    <li
                                      key={index}
                                      className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                                    >
                                      <BookMarked className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                                      <span>
                                        {source.title}
                                        {source.heading ? ` — ${source.heading}` : ""}
                                        {source.concept ? ` · ${source.concept}` : ""}
                                        <span className="ml-1 tabular-nums opacity-70">
                                          {Math.round(source.similarity * 100)}% match
                                        </span>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                    {send.isPending ? (
                      <div className="flex gap-3">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Bot className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <div className="flex items-center gap-1.5 rounded-2xl border border-border/60 bg-card px-3.5 py-3">
                          {[0, 1, 2].map((dot) => (
                            <span
                              key={dot}
                              className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                              style={{ animationDelay: `${dot * 150}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div ref={endRef} />
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {send.error ? (
            <ErrorState
              error={send.error}
              onRetry={() => {
                const last = [...turns].reverse().find((turn) => turn.role === "user");
                if (last) send.mutate(last.content);
              }}
            />
          ) : null}

          {misconception ? (
            <Card className="surface-card border-warning/40">
              <CardContent className="flex items-start gap-2.5 p-4">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-warning">
                    Recorded as a misconception
                  </p>
                  <p className="text-sm font-medium">“{misconception.statement}”</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{misconception.correction}</p>
                  <p className="text-[11px] text-muted-foreground">
                    It will show up on your progress page until a question that targets it is answered
                    correctly.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(draft);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              placeholder={
                tutor.available === false ? "The tutor is not configured on the server." : "Ask a question…"
              }
              disabled={tutor.available === false}
              rows={2}
              maxLength={4000}
              className="min-h-[56px] resize-none"
              aria-label="Your question"
            />
            <Button type="submit" size="icon" className="h-[56px] w-12 shrink-0" disabled={!draft.trim() || send.isPending || tutor.available === false}>
              <Send className="h-4 w-4" aria-hidden />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>

        <aside className="space-y-2 lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your conversations
          </h2>
          {apiTarget !== "python" ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Conversation history needs the EduVerse API server. Chatting still works.
            </p>
          ) : conversations.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (conversations.data?.conversations ?? []).length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Nothing yet. Your first question starts a conversation you can come back to.
            </p>
          ) : (
            (conversations.data?.conversations ?? []).map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  conversation.id === conversationId
                    ? "border-primary/50 bg-primary/5"
                    : "border-border/60 hover:border-primary/30 hover:bg-muted/40",
                )}
              >
                <span className="line-clamp-2 font-medium">{conversation.title}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  {conversation.mode}
                </span>
              </button>
            ))
          )}
        </aside>
      </div>
    </div>
  );
};

export default Tutor;
