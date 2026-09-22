# EduVerse backend

FastAPI. This process holds everything the browser must not be trusted with:

| Secret / capability | Why it cannot live in the frontend |
| --- | --- |
| `GEMINI_API_KEY`, `HUGGINGFACE_API_KEY` | Anything in a `VITE_*` variable is in the shipped bundle. |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses row-level security completely. |
| Quiz answer keys | `quiz_questions` has no student SELECT policy; only `/quiz-submit` compares against `correct_index`. |
| Grading | `student_attempts` has no client INSERT policy, so a student cannot post themselves a score. |
| Role grants | `user_roles` is written only by `/role-requests/review`, and only by an admin. |

The browser keeps the anon key and the signed-in user's own access token. That is all it needs.

## Running it

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Linux/macOS: . .venv/bin/activate
pip install -r requirements.txt
# Fill in the project-root .env with the backend keys below.
uvicorn app.main:app --reload --port 8000
```

Then point the frontend at it with `VITE_API_URL=http://localhost:8000/api` in the project-root `.env`.

Interactive API docs: <http://localhost:8000/docs>. Configuration report: <http://localhost:8000/api/health>.

## What "not configured" means

Nothing here has a working default that lets a missing key pass unnoticed. Without `GEMINI_API_KEY` the tutor returns

```json
{ "error": "…an administrator needs to add a Gemini API key.", "code": "gemini_not_configured" }
```

and the UI renders that as a settings notice. It does not return a canned reply, and it never invents a score, a statistic or a citation. `GET /api/health` lists exactly what is missing.

## Layout

```
app/
  config.py      Settings from the environment; no secret-bearing defaults
  errors.py      PublicError -> {error, code}; the envelope the frontend parses
  db.py          PostgREST client (service role, and .as_user() for RLS-bound reads)
  auth.py        Identity from GoTrue, roles from public.user_roles — never from the request
  services/
    gemini.py      Gemini REST; structured JSON output; no fallback text anywhere
    embeddings.py  Hugging Face feature-extraction, mean-pooled to 384 dims
    decay.py       Concept-decay maths (see "Four copies" below)
    sandbox.py     Runs student code. NOT a security boundary — read its docstring
  routers/
    health.py      Honest configuration report
    quiz.py        /quiz-start, /quiz-submit
    tutor.py       /aiva-chat + conversation history
    plan.py        /learning-plan — rules, deliberately no model call
    code.py        /code-run, /code-mentor, /code-hint
    diagnostic.py  Adaptive placement check
    rag.py         /rag-ingest (faculty), /rag-search
    focus.py       Focus sessions — measurable signals only
    content.py     draft→submitted→approved→published→archived, and role requests
```

## Code execution

`services/sandbox.py` runs submissions in a subprocess with a scratch working directory, a stripped environment, a wall-clock timeout with a hard kill, and CPU/address-space limits where the OS provides them (POSIX only — Windows has no `setrlimit`).

**It is a grader, not a security sandbox.** Deploy this server in a container that holds no credentials the grader needs, has no outbound network access, and is disposable. Or set `CODE_EXECUTION_ENABLED=false`, in which case `/code-run` returns `code_execution_disabled` and the mentor and hints still work.

Verified locally: Python and JavaScript submissions both execute, correct solutions pass, wrong ones fail, syntax errors are reported as compile errors rather than as failed tests, and an infinite loop is killed at the timeout.

## Four copies of the decay formula

Concept-decay risk is computed in four places because four runtimes need it:

| Where | Why |
| --- | --- |
| `supabase/migrations/20260916090100_eduverse_core_schema.sql` → `concept_decay_risk()` | Ordering inside SQL queries |
| `supabase/functions/_shared/decay.ts` | The Deno Edge Function deployment path |
| `src/lib/mastery.ts` | Rendering without a round trip |
| `backend/app/services/decay.py` | This server |

Change one, change all four. They are listed in each file's header for that reason.

## Relationship to `supabase/functions/`

The Deno Edge Functions implement the same wire contract — same endpoint names, same request and response shapes, same `{error, code}` envelope — and remain as the Supabase-only deployment path. **This Python backend is the primary one.** Do not let them diverge: a fix applied to one must be applied to the other, or one of them deleted.
