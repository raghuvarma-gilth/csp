# EduVerse

An adaptive learning platform for data structures and algorithms. It measures what a
student actually knows, teaches the concepts they are weak on, generates practice aimed
at those concepts, grades real code, and recommends what to learn next.

The design constraint that shapes everything here is that **nothing is invented**. Every
percentage on a dashboard is counted from attempts a student made. Every tutor answer is
grounded in published course material, and when the material does not cover a question
the tutor says so rather than guessing. When an API key is missing, the feature reports
itself unavailable instead of returning a canned reply. There is no mock data path.

---

## Architecture

Three processes, with a deliberate split of what each is trusted with.

| Layer | Stack | Holds |
| --- | --- | --- |
| **Frontend** | Vite 5 + React 18 + TypeScript, Tailwind + shadcn/ui, React Router 6, TanStack Query, three.js | The anon key and the signed-in user's own access token. Nothing else. |
| **Backend** | FastAPI (Python), 33 endpoints | Gemini and Hugging Face keys, the Supabase service-role key, quiz answer keys, grading, role grants. |
| **Database** | Supabase — Postgres, Auth, RLS, Storage, pgvector | The schema, with row-level security on every table and `SECURITY DEFINER` functions for the reads RLS cannot express. |

The frontend never talks to a model provider and never holds a key that grants anything
on its own. See [`backend/README.md`](backend/README.md) for the table of what lives on
the server and why each item cannot move.

`supabase/functions/` holds Deno Edge Functions implementing the **same wire contract** as
the Python backend — same endpoint names, same request and response shapes. They are the
Supabase-only deployment path. The Python backend is the primary one; leave `VITE_API_URL`
blank to use the Edge Functions instead.

---

## Getting started

Requires Node.js 18+, npm, and Python 3.11+ for the backend.

### 1. Frontend

```bash
npm install
cp .env.example .env     # then fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

Serves on **http://localhost:8080** (set in `vite.config.ts`).

Everything in `.env` is compiled into the bundle and readable by anyone who opens the
site, so it holds only values that are safe in public. `.env.example` lists what must
never go there.

### 2. Backend

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Linux/macOS: . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then fill in the keys below
uvicorn app.main:app --reload --port 8000
```

| Variable | Needed for |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Everything |
| `GEMINI_API_KEY` | Tutor, quiz generation, diagnostic, code mentor (primary AI provider) |
| `GROK_API_KEY` | Tutor, quiz generation, diagnostic, code mentor (alternative AI provider) |
| `HUGGINGFACE_API_KEY` | Embeddings for retrieval |

At least one of `GEMINI_API_KEY` or `GROK_API_KEY` must be set for AI features to work.
When both are configured, Gemini is the primary provider.

`GET /api/health` reports exactly which of these are missing. Interactive docs at
`/docs`.

### 3. Database

Apply the migrations in `supabase/migrations/` in filename order. The `20260916*` series
onward is the current schema; the four `2025*`/`2026010*` files are the Lovable prototype's
and are superseded by it.

One migration is held back deliberately: **`20260916090500_eduverse_drop_legacy_tables.sql`
drops the prototype's tables.** Apply it only once you have confirmed
`20260916090400_eduverse_migrate_legacy_data.sql` moved everything you care about.

### Seeded curriculum

The migrations seed a real curriculum, not fixtures. Every lesson is written teaching
material, every coding problem has hidden test cases, and every concept is wired into a
prerequisite DAG so the roadmap has something to compute over:

| Course | Code | Chapters | Concepts | Topics |
| --- | --- | --- | --- | --- |
| Data Structures Fundamentals | CS201 | 3 | 11 | arrays & strings, stacks, queues |
| Linked Structures & Hashing | CS202 | 3 | 10 | linked lists, pointer techniques, hash tables |
| Trees, Heaps & Ordered Structures | CS203 | 4 | 13 | traversal, BSTs, AVL, heaps, tries, segment/Fenwick trees |
| Sorting & Searching | CS204 | 2 | 8 | the six sorts, the comparison bound, binary search & boundaries |
| Graphs & Networks | CS205 | 2 | 7 | BFS/DFS, topological sort, Dijkstra, union-find, MSTs |
| Recursion & Dynamic Programming | CS206 | 2 | 11 | call stack, recursion trees, backtracking, six classic DPs |
| **Total** | | **16** | **60** | plus **38** coding problems |

Each concept sets `visual_key` to an entry in `VISUAL_CATALOGUE`
(`src/components/visual/catalogue.ts`), so every lesson has a matching interactive
visualisation in the lab, and no visualisation is left without a lesson. The 49 keys used
by CS202–CS206 are distinct, which is checked by the inventory block in
`20261007090500_eduverse_achievements_rescale.sql` — it `RAISE WARNING`s if the published
concept or problem counts drift from what the achievement thresholds were written for.

Prerequisites cross course boundaries deliberately: a linked list depends on
`array-fundamentals` in CS201, Dijkstra depends on `heap-operations` in CS203, and
memoisation depends on `hash-tables` in CS202. Both sides of every edge are scoped to a
named course, because `concepts.slug` is only `UNIQUE (chapter_id, slug)`.

Lesson bodies may use `diagram:<key>` figures, but **only the 13 keys defined in
`src/components/learning/diagrams.tsx` exist** — an unknown key renders a visible "figure
missing" note. The CS202–CS206 lessons therefore use prose, cost tables, code and
`:::key` / `:::pitfall` / `:::example` callouts instead, and lean on the interactive
visualisation rather than a static SVG.

---

## Routes

Public:

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/auth` | **Sign in only** |
| `/register` | Student registration (the default) |
| `/register/faculty` | Professor / teacher registration |
| `/register/industry` | Industry professional registration |

Signed in — all of these sit behind `ProtectedRoute` inside the shared app shell, and RLS
enforces the same boundary again on every query:

| Path | What it does |
| --- | --- |
| `/home` | Dashboard: mastery, due concepts, next action |
| `/learn`, `/learn/:concept`, `/learn/:course/:module` | Long-form lessons with figures and worked examples |
| `/library` | What faculty and industry contributors published, once a reviewer approved it |
| `/updates` | Faculty announcements and open industry opportunities. Both drop off once expired or closed |
| `/roadmap` | Prerequisite graph and sequence |
| `/practice`, `/practice/:concept` | Quizzes targeted at weak concepts |
| `/tutor` | AIVA — the retrieval-grounded chat tutor |
| `/code`, `/code/:problem` | Coding problems, executed and graded server-side |
| `/visual` | Concept visualisations |
| `/visual/lab` | The DSA lab: **22 modules, 144 operations**, animated in three.js |
| `/focus` | Focus sessions — measurable timing signals only |
| `/progress`, `/achievements`, `/profile` | Counted from real attempts |
| `/diagnostic` | Adaptive placement check |
| `/request-access` | Apply for contributor access |

Staff areas, gated on roles an administrator grants: `/faculty`, `/research` (authoring
and review), `/industry` (posting opportunities), `/admin`.

Those four are the four dashboards. They share one shell — header, background, theme,
sign-out — but each carries its own rail, and each role lands somewhere different on
sign-in: a professor arrives on their review queue, an industry account on their
postings, an administrator on the approval queues. That is navigation, not permission:
typing another role's path reaches `ProtectedRoute`, which asks the server, and every
query behind it is checked again by RLS.

### Retired prototype routes

These now redirect rather than 404, so existing links keep working:
`/dashboard`, `/student-dashboard` → `/home` · `/adaptive-learning` → `/roadmap` ·
`/learnflow` → `/learn` · `/talk2code` → `/code` · `/ar-learning` → `/visual` ·
`/mindpulse` → `/focus` · `/progress-board` → `/progress` · `/select-role` →
`/request-access`.

The prototype's AR-teaching, voice-coding and emotional-state monitoring features are
**gone, not hidden.** MindPulse in particular displayed happiness, stress and wellbeing
readings that no sensor produced; `/focus` replaces it with session timings that are
actually measured.

---

## Roles, and why a student cannot promote themselves

There is one enum — `student`, `faculty`, `research_expert`, `industry_expert`, `admin` —
and exactly one way to move between its values.

Registration sends an **intent**, never a role. `/register/faculty` puts
`signup_intent: 'faculty'` in user metadata, which is attacker-controlled by definition.
The server's response to it is fixed:

1. `handle_new_user()` writes `'student'` to `user_roles` **unconditionally**.
2. It treats the intent as a request and inserts a **pending** row in `role_requests`.
3. An administrator reviewing that request via `/role-requests/review` is the only thing
   that ever changes a role.

Three independent layers enforce this: the trigger's own IN-list, a CHECK constraint
limiting `role_requests` to elevatable roles, and the **absence of any INSERT policy on
`user_roles` that a browser can reach**. Forging an intent buys exactly what an honest
one does — a request someone has to read. The registration forms say so on the page.

`admin` has no request path at all. It is granted out-of-band by an existing admin.

### Content pipeline

Contributed material moves `draft → submitted → approved → published → archived`.
Students read `published` rows and nothing else — enforced by the table's SELECT policy
and independently by `published_contributions()`, a `SECURITY DEFINER` function that takes
no arguments. A CHECK constraint refuses any row whose reviewer is its own author, so
**no one can approve their own work.**

Three kinds go through review — `research`, `announcement`, `opportunity` — and who may
do what with each is a table in `backend/app/routers/content.py`, not a convention:

| Kind | Authors | Reviewers |
| --- | --- | --- |
| `research` | faculty, research experts, industry professionals | faculty, administrators |
| `announcement` | faculty | faculty, administrators |
| `opportunity` | industry professionals | faculty, administrators |

Announcements and opportunities additionally go live on their own terms: a notice stops
being shown once its `expires_at` has passed, and a listing stops being shown once its
`deadline` has. `published_announcements()` and `published_opportunities()` apply that
filter server-side, so a count a student reads is a count of things they can still act
on. Nothing on the student side falls back to example data — an empty table means an
empty section that says so.

Course material is the exception to the review workflow: `course`, `chapter`, `concept`
and `problem` are authored and published directly by faculty, which is what the seed
migrations themselves do.

---

## Scripts

```bash
npm run dev          # dev server on :8080 (regenerates sitemap/robots first)
npm run build        # production build
npm run typecheck    # tsc --build --force tsconfig.json
npm run lint         # eslint .
npm run verify:lab   # executes every DSA lab algorithm and checks the results
```

`npm run typecheck` must be used rather than `tsc --noEmit`. The root `tsconfig.json` is
`"files": []` plus project references, so a bare `--noEmit` against it checks **nothing**
and exits 0.

`npm run verify:lab` runs the lab's algorithms in Node and checks them against
independently-known answers — sorts come out sorted, BST in-order traversal ascends, heaps
hold the heap property, segment trees agree with brute force, N-Queens returns the
textbook solution counts. The algorithm layer lives under
`src/components/visual/lab/algorithms/` precisely so it can be executed without a browser.

`predev` and `prebuild` run `scripts/generate-seo.ts`, which writes `public/sitemap.xml`
and `public/robots.txt` from `SITE_URL`. Editing those two files by hand does nothing;
they are overwritten on every build.

---

## Layout

```
src/
  pages/              One file per route
  pages/auth/         The three registration forms
  components/auth/    Shared sign-in and registration pieces (fields, validation, shell)
  components/visual/lab/
    algorithms/         Pure frame generators — no DOM, runnable in Node
    renderers/          three.js scene painters
    modules/            22 module definitions: 144 ops, params, pseudocode, complexity
  hooks/              useAuth, useUserRole
  integrations/supabase/
backend/              FastAPI — see backend/README.md
supabase/
  migrations/         Schema, RLS, SECURITY DEFINER functions, seed curriculum
  functions/          Deno Edge Functions (alternative deployment, same contract)
scripts/              SEO generation, icon generation, lab verification
```

---

## Before you trust a change

This repository was generated by Lovable and has since been substantially rewritten —
duplicate dashboards collapsed into one canonical route per capability, unguarded pages
put behind `ProtectedRoute`, fake metrics deleted, and the server layer moved from
browser-held keys to FastAPI. Treat the three checks as mandatory rather than optional:

```bash
npm run typecheck && npm run lint && npm run verify:lab
```

The decay formula is implemented in **four** places, because four runtimes need it:
`20260916090100_eduverse_core_schema.sql` (`concept_decay_risk()`),
`supabase/functions/_shared/decay.ts`, `src/lib/mastery.ts`, and
`backend/app/services/decay.py`. Each file's header says so. Change one, change all four.

Likewise, `supabase/functions/` and `backend/` implement the same contract. A fix to one
belongs in the other, or one of them should be deleted.
