import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VISUAL_CATALOGUE } from "@/components/visual/catalogue";
import { Switch } from "@/components/ui/switch";
import { callFunction, errorMessage, patchJson } from "@/lib/api";
import { OPPORTUNITY_KIND_LABEL, type ContentStatus } from "@/components/workspace/pipeline";

/**
 * The authoring form.
 *
 * Three things about it are deliberate:
 *
 * 1. `status` is not a field. Content moves through the pipeline by a
 *    transition the server authorises, never by someone typing "published"
 *    into a form.
 *
 * 2. Only fields the author actually changed are sent. The list endpoint does
 *    not return long bodies — `content`, `prompt`, `starter_code` — so this
 *    form cannot show what is currently stored for them. Rather than render an
 *    empty box that silently wipes a lesson on save, those fields say "leave
 *    blank to keep what is stored" and a blank one is simply not sent.
 *
 * 3. The server filters the payload again against its own `EDITABLE` map. This
 *    form is a convenience, not a permission boundary.
 */

export type ContentKind =
  | "course"
  | "chapter"
  | "concept"
  | "problem"
  | "research"
  | "announcement"
  | "opportunity";

export interface ContentRow {
  id: string;
  title: string;
  status: ContentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  slug?: string | null;
  [key: string]: unknown;
}

export interface ParentOption {
  id: string;
  title: string;
  group?: string;
}

type FieldType =
  | "text"
  | "textarea"
  | "code"
  | "number"
  | "select"
  | "json"
  | "parent"
  | "date"
  | "datetime"
  | "boolean"
  | "list";

interface Field {
  name: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
  rows?: number;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
  /** Not returned by the list endpoint, so never pre-filled. */
  writeOnly?: boolean;
  requiredOnCreate?: boolean;
}

export const KIND_LABEL: Record<ContentKind, string> = {
  course: "Course",
  chapter: "Chapter",
  concept: "Concept",
  problem: "Coding problem",
  research: "Research item",
  announcement: "Announcement",
  opportunity: "Opportunity",
};

/** Which list a kind's reference field is chosen from. */
export const PARENT_OF: Partial<Record<ContentKind, ContentKind>> = {
  chapter: "course",
  concept: "chapter",
  problem: "concept",
  research: "concept",
  announcement: "course",
  opportunity: "concept",
};

const SLUG_HINT = "Lowercase letters, numbers and hyphens. It becomes part of the URL.";

/** Mirrors EDITABLE in backend/app/routers/content.py. */
export const FIELDS: Record<ContentKind, Field[]> = {
  course: [
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    { name: "slug", label: "Slug", type: "text", hint: SLUG_HINT, requiredOnCreate: true },
    { name: "code", label: "Course code", type: "text", placeholder: "CS201" },
    { name: "subject", label: "Subject", type: "text", placeholder: "Computer Science" },
    { name: "description", label: "Description", type: "textarea", rows: 3 },
    { name: "position", label: "Order", type: "number", min: 0, hint: "Lower numbers sort first." },
  ],
  chapter: [
    { name: "course_id", label: "Course", type: "parent", requiredOnCreate: true },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    { name: "slug", label: "Slug", type: "text", hint: SLUG_HINT, requiredOnCreate: true },
    { name: "description", label: "Description", type: "textarea", rows: 3 },
    { name: "position", label: "Order", type: "number", min: 0 },
  ],
  concept: [
    { name: "chapter_id", label: "Chapter", type: "parent", requiredOnCreate: true },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    { name: "slug", label: "Slug", type: "text", hint: SLUG_HINT, requiredOnCreate: true },
    {
      name: "summary",
      label: "Summary",
      type: "textarea",
      rows: 2,
      hint: "One or two sentences. Shown on cards and in search.",
    },
    {
      name: "content",
      label: "Lesson body",
      type: "textarea",
      rows: 12,
      writeOnly: true,
      hint: "Markdown. Headings, lists, `code` and fenced blocks are rendered; raw HTML is not.",
    },
    { name: "difficulty", label: "Difficulty (1–5)", type: "number", min: 1, max: 5 },
    { name: "estimated_minutes", label: "Estimated minutes", type: "number", min: 1 },
    {
      name: "visual_key",
      label: "Visualisation",
      type: "select",
      hint: "Links this concept to a DSA visualiser. Only keys with a built visualisation are listed.",
      options: [
        { value: "", label: "None" },
        /* The list is long enough now that bare titles are ambiguous — "Build",
           "Search" and "Insert" recur across structures. The group prefix is the
           same idiom the parent select below uses. A flat shadcn `Select` has no
           optgroup, so the prefix is the grouping. */
        ...VISUAL_CATALOGUE.map((entry) => ({
          value: entry.key,
          label: `${entry.group} · ${entry.title}`,
        })),
      ],
    },
    { name: "position", label: "Order", type: "number", min: 0 },
  ],
  problem: [
    { name: "concept_id", label: "Concept", type: "parent", requiredOnCreate: true },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    { name: "slug", label: "Slug", type: "text", hint: SLUG_HINT, requiredOnCreate: true },
    {
      name: "prompt",
      label: "Problem statement",
      type: "textarea",
      rows: 8,
      writeOnly: true,
      requiredOnCreate: true,
    },
    { name: "difficulty", label: "Difficulty (1–5)", type: "number", min: 1, max: 5 },
    {
      name: "starter_code",
      label: "Starter code",
      type: "json",
      rows: 6,
      writeOnly: true,
      placeholder: '{\n  "python": "def solve(nums):\\n    pass",\n  "javascript": ""\n}',
      hint: "A JSON object keyed by language.",
    },
    {
      name: "test_cases",
      label: "Test cases",
      type: "json",
      rows: 8,
      writeOnly: true,
      placeholder: '[\n  { "input": [1, 2], "expected": 3, "hidden": false }\n]',
      hint: "A JSON array. Hidden cases run but are not shown to the student.",
    },
    {
      name: "expected_complexity",
      label: "Expected complexity",
      type: "text",
      placeholder: "O(n) time, O(1) space",
    },
    {
      name: "hints",
      label: "Hints",
      type: "json",
      rows: 4,
      writeOnly: true,
      placeholder: '["Start from both ends", "The array is sorted — use that"]',
      hint: "A JSON array of strings, revealed one at a time. Using one costs the unaided badge.",
    },
  ],
  research: [
    { name: "concept_id", label: "Concept it supports", type: "parent" },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    {
      name: "content_type",
      label: "Kind",
      type: "select",
      requiredOnCreate: true,
      options: [
        { value: "research_note", label: "Research note" },
        { value: "case_study", label: "Case study" },
        { value: "real_world_application", label: "Real-world application" },
        { value: "code_example", label: "Code example" },
        { value: "dataset", label: "Dataset" },
        { value: "reference", label: "Reference" },
      ],
    },
    {
      name: "content",
      label: "Body",
      type: "textarea",
      rows: 12,
      writeOnly: true,
      requiredOnCreate: true,
      hint: "Markdown. Raw HTML is not rendered.",
    },
    {
      name: "code_language",
      label: "Code language",
      type: "text",
      placeholder: "python",
      hint: "Only if the body contains code.",
    },
    {
      name: "citations",
      label: "Citations",
      type: "json",
      rows: 4,
      writeOnly: true,
      placeholder: '[\n  { "title": "Paper title", "url": "https://…" }\n]',
      hint: "A JSON array. Anything you assert should be traceable to one of these.",
    },
  ],
  announcement: [
    {
      name: "course_id",
      label: "Course",
      type: "parent",
      hint: "Leave empty if this is for everyone rather than one course.",
    },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    {
      name: "body",
      label: "Announcement",
      type: "textarea",
      rows: 8,
      requiredOnCreate: true,
      hint: "Markdown. Raw HTML is not rendered.",
    },
    {
      name: "pinned",
      label: "Pin to the top",
      type: "boolean",
      hint: "Pinned notices sort above the rest for as long as they are live.",
    },
    {
      name: "expires_at",
      label: "Stop showing after",
      type: "datetime",
      hint: "Optional. Past this moment students stop seeing it — a reminder for a date that has gone is worse than no reminder.",
    },
  ],
  opportunity: [
    {
      name: "kind",
      label: "Kind",
      type: "select",
      requiredOnCreate: true,
      options: Object.entries(OPPORTUNITY_KIND_LABEL).map(([value, label]) => ({
        value,
        label,
      })),
    },
    { name: "title", label: "Title", type: "text", requiredOnCreate: true },
    {
      name: "organisation",
      label: "Organisation",
      type: "text",
      requiredOnCreate: true,
      placeholder: "Who is offering this",
    },
    {
      name: "organisation_url",
      label: "Organisation website",
      type: "text",
      placeholder: "https://…",
      hint: "Must start with http:// or https://.",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      rows: 8,
      writeOnly: true,
      requiredOnCreate: true,
      hint: "Markdown. What the work is, who it suits, what happens next.",
    },
    {
      name: "location",
      label: "Location",
      type: "text",
      placeholder: "Remote · Bengaluru · Hybrid",
    },
    {
      name: "apply_url",
      label: "Where to apply",
      type: "text",
      placeholder: "https://…",
      hint: "Must start with http:// or https://. Students click this, so the database refuses anything else.",
    },
    {
      name: "deadline",
      label: "Closing date",
      type: "date",
      hint: "Optional. Once it passes, the listing drops off the student dashboard rather than padding a count.",
    },
    {
      name: "skills",
      label: "Skills asked for",
      type: "list",
      placeholder: "Python, SQL, Git",
      hint: "Comma separated.",
    },
    {
      name: "concept_id",
      label: "Related concept",
      type: "parent",
      hint: "Optional. Links the posting to the curriculum it draws on.",
    },
  ],
};

/**
 * `<input type="datetime-local">` only speaks "YYYY-MM-DDTHH:mm", and only in
 * the browser's own timezone. Converting here and back on submit means the
 * author picks a wall-clock time and the database stores the instant it meant.
 */
const toLocalInput = (iso: string): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
};

const initialValue = (field: Field, item: ContentRow | null): string => {
  if (!item || field.writeOnly) return "";
  const raw = item[field.name];
  if (raw === null || raw === undefined) return "";
  if (field.type === "list") return Array.isArray(raw) ? raw.join(", ") : String(raw);
  if (field.type === "boolean") return raw ? "true" : "false";
  if (field.type === "datetime") return toLocalInput(String(raw));
  if (field.type === "date") return String(raw).slice(0, 10);
  if (typeof raw === "object") return JSON.stringify(raw, null, 2);
  return String(raw);
};

export const ContentEditor = ({
  kind,
  item,
  parents,
  parentsNotice,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: ContentKind;
  item: ContentRow | null;
  parents: ParentOption[];
  parentsNotice?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) => {
  const fields = FIELDS[kind];
  const [values, setValues] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const initial = useMemo(() => {
    const seed: Record<string, string> = {};
    for (const field of fields) seed[field.name] = initialValue(field, item);
    return seed;
  }, [fields, item]);

  /* Re-seed whenever the dialog opens on a different row. */
  useEffect(() => {
    if (open) {
      setValues(initial);
      setProblem(null);
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async (payload: Record<string, unknown>) =>
      item
        ? patchJson(`content/${kind}/${item.id}`, { kind, values: payload })
        : callFunction(`content`, { kind, values: payload }),
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);

    const payload: Record<string, unknown> = {};

    for (const field of fields) {
      /* Radix refuses an empty option value, so "no visualisation" is carried
         as the sentinel "none" and turned back into an absent value here. */
      const entered = (values[field.name] ?? "").trim();
      const raw = field.type === "select" && entered === "none" ? "" : entered;

      if (!item && field.requiredOnCreate && !raw) {
        setProblem(`${field.label} is required.`);
        return;
      }

      /* Unchanged fields are not sent, so a blank long-form box cannot wipe a
         stored lesson body it was never able to display. */
      if (raw === (initial[field.name] ?? "")) continue;

      if (!raw) {
        /* An emptied optional field is a real change: send null. The two
           NOT NULL columns with defaults are the exception — an empty skills
           box means no skills, not a constraint violation. */
        if (field.type === "list") payload[field.name] = [];
        else if (field.type === "boolean") payload[field.name] = false;
        else payload[field.name] = null;
        continue;
      }

      if (field.type === "boolean") {
        payload[field.name] = raw === "true";
        continue;
      }

      if (field.type === "list") {
        payload[field.name] = raw
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
        continue;
      }

      if (field.type === "datetime") {
        const at = new Date(raw);
        if (Number.isNaN(at.getTime())) {
          setProblem(`${field.label} is not a valid date and time.`);
          return;
        }
        payload[field.name] = at.toISOString();
        continue;
      }

      if (field.type === "number") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          setProblem(`${field.label} must be a number.`);
          return;
        }
        payload[field.name] = parsed;
        continue;
      }

      if (field.type === "json") {
        try {
          payload[field.name] = JSON.parse(raw);
        } catch (cause) {
          setProblem(
            `${field.label} is not valid JSON — ${
              cause instanceof Error ? cause.message : "check the brackets and commas"
            }.`,
          );
          return;
        }
        continue;
      }

      payload[field.name] = raw;
    }

    if (Object.keys(payload).length === 0) {
      setProblem("Nothing has changed.");
      return;
    }

    save.mutate(payload);
  };

  const parentKind = PARENT_OF[kind];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? `Edit ${KIND_LABEL[kind].toLowerCase()}` : `New ${KIND_LABEL[kind].toLowerCase()}`}
          </DialogTitle>
          <DialogDescription>
            {item
              ? "Saving does not change where this sits in the pipeline. Move it separately."
              : "New material starts as a draft. Students cannot see it until it has been reviewed and published."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {fields.map((field) => {
            const id = `${kind}-${field.name}`;
            const value = values[field.name] ?? "";
            const setValue = (next: string) =>
              setValues((current) => ({ ...current, [field.name]: next }));

            return (
              <div key={field.name} className="space-y-1.5">
                <Label htmlFor={id} className="text-xs">
                  {field.label}
                  {!item && field.requiredOnCreate ? (
                    <span className="ml-1 text-destructive" aria-hidden>
                      *
                    </span>
                  ) : null}
                </Label>

                {field.type === "parent" ? (
                  <>
                    <Select value={value} onValueChange={setValue}>
                      <SelectTrigger id={id}>
                        <SelectValue
                          placeholder={
                            parents.length === 0
                              ? `No ${parentKind ?? "parent"} to choose from yet`
                              : "Choose one"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {parents.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.group ? `${option.group} · ` : ""}
                            {option.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {parentsNotice ? (
                      <p className="text-[11px] text-muted-foreground">{parentsNotice}</p>
                    ) : null}
                  </>
                ) : field.type === "select" ? (
                  <Select value={value} onValueChange={setValue}>
                    <SelectTrigger id={id}>
                      <SelectValue placeholder="Choose one" />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options ?? []).map((option) => (
                        <SelectItem key={option.value || "none"} value={option.value || "none"}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "boolean" ? (
                  <div className="flex items-center gap-2">
                    <Switch
                      id={id}
                      checked={value === "true"}
                      onCheckedChange={(next) => setValue(next ? "true" : "false")}
                    />
                    <span className="text-xs text-muted-foreground">
                      {value === "true" ? "Yes" : "No"}
                    </span>
                  </div>
                ) : field.type === "date" || field.type === "datetime" ? (
                  <Input
                    id={id}
                    type={field.type === "date" ? "date" : "datetime-local"}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    className="w-auto"
                  />
                ) : field.type === "number" ? (
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  />
                ) : field.type === "textarea" || field.type === "json" || field.type === "code" ? (
                  <Textarea
                    id={id}
                    rows={field.rows ?? 4}
                    value={value}
                    placeholder={
                      item && field.writeOnly
                        ? "Leave blank to keep what is stored."
                        : field.placeholder
                    }
                    onChange={(event) => setValue(event.target.value)}
                    className={field.type === "json" ? "font-mono text-xs" : undefined}
                    spellCheck={field.type !== "json"}
                  />
                ) : (
                  <Input
                    id={id}
                    value={value}
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(event.target.value)}
                  />
                )}

                {field.hint ? (
                  <p className="text-[11px] text-muted-foreground">{field.hint}</p>
                ) : null}
              </div>
            );
          })}

          {problem || save.error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden />
              <AlertDescription className="text-xs">
                {problem ?? errorMessage(save.error)}
              </AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : item ? "Save changes" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
