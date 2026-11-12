# Document Chaser: Architecture

TypeScript stack. All data is synthetic.

## 1. Summary

A local, single-user web app. The frontend is React with TypeScript and Vite. The backend is Node.js 22 with TypeScript, Express 5, and SQLite. Gap detection and follow-up rules are deterministic TypeScript functions with no model calls. The Gemini model writes draft text only, and is called from the backend. The API key stays on the server.

## 2. Repository layout

```
document-chaser/
  .env.example           keys with empty values
  .gitignore             excludes .env, node_modules, data/*.db, dist
  README.md              Windows PowerShell setup
  design/               Stitch export (read only)
  JTBD.md
  ARCHITECTURE.md
  data/seed/             synthetic JSON seed files
  backend/
    src/
      index.ts           app bootstrap, binds 127.0.0.1
      config.ts          env loading and validation (zod)
      db/schema.ts      Drizzle schema
      db/seed.ts        seed loader
      rules/gapEngine.ts
      rules/followUp.ts
      rules/metrics.ts
      services/draftService.ts
      services/geminiClient.ts
      routes/*.ts
    test/                Vitest and supertest tests
  frontend/
    src/
      screens/          five Stitch-derived screens
      components/       shared UI from design/
      api/client.ts     typed fetch wrapper
      styles/tokens.css design tokens from design/
    test/               Vitest and Testing Library smoke tests
```

## 3. Components

Server, config: reads .env with dotenv and validates it with zod at startup. Fails fast if required values are malformed. Exposes the key to services only, never to routes.

Server, database: SQLite file at DATABASE_URL, accessed through Drizzle ORM with better-sqlite3. Schema is typed in TypeScript and initialized from committed SQLite migrations with Drizzle's migrator.

Server, gap engine: pure function from (case requirements, documents, as-of date) to a gap list. No I/O.

Server, follow-up engine: pure function from (approval date, as-of date, client replies, existing tasks) to the set of tasks that should exist. No I/O.

Server, metrics: pure function from requirement records to median cycle time and rounds per case.

Server, draft service: builds the prompt from the gap list, calls Gemini with an 8 second timeout, validates the output, and falls back to the template on any failure. Never throws to a route.

Server, routes: thin Express handlers. Validate input with zod. Call services. Return JSON. No route returns the API key, environment values, or stack traces outside development.

Web: React with TypeScript. Calls the server only. Holds no secrets.

## 4. Data model

Tables and columns, all with synthetic data.

clients: id, name, client_type (corporate or individual), is_synthetic (true).

cases: id, client_id, rm_name, opened_on, approved_on (nullable), status (open, awaiting_client, ready_for_review, complete, parked).

requirement_types: code, label, applies_to (client_type), reason_text, max_age_days (nullable).

requirements: id, case_id, requirement_code, requested_on (nullable), received_on (nullable), status (missing, needs_resubmission, received).

documents: id, case_id, requirement_code, issued_on (nullable), expires_on (nullable), legible (boolean), submitted_on.

events: id, case_id, type (requested, approved, client_reply, received, reminder_created, call_created, held, parked), occurred_on, payload (JSON text).

drafts: case_id, subject, body, source (gemini or template), edited (boolean), updated_on.

tasks: id, case_id, type (reminder or call), due_on, done_on (nullable), cancelled_on (nullable).

Rule: every table row carries or derives from is_synthetic data only. The seed loader refuses to run if a record lacks the synthetic flag.

## 5. Seed data

Three cases, fixed so the demo is repeatable.

CS-1041, Lumen Textiles Ltd, corporate. Checklist has 10 requirement types. Six received, one with issued_on 210 days before as-of, so needs_resubmission under the register rule, and three missing.

CS-1047, Orion Freight Co, corporate. One missing item.

CS-1052, Harbor Dental Group, corporate. Five missing. Approved on 2026-11-10. Default AS_OF_DATE is 2026-11-12, which is day 2, so no reminder exists yet. Advancing to 2026-11-13 makes day 3 and creates the reminder. This fixes an error in the prior plan, where a 14-day-old approval would have skipped the day-3 step.

Historical requested and received events exist for CS-1041 and CS-1052 across three rounds, so the pilot median can be computed from seed data.

## 6. Rules

Gap rules, evaluated per requirement for the case's client_type.

Missing: no document record exists for the requirement code.
Needs resubmission: the requirement has max_age_days and the latest document's issued_on is older than max_age_days from the as-of date. Also applies when expires_on is before the as-of date, or legible is false.
Received: otherwise.

Register of directors uses max_age_days of 90.

Follow-up rules, counted in calendar days from approved_on, using the as-of date.

Day 3, no client_reply since approval: create a reminder task due on day 3.
Day 5, no client_reply since approval: create a call task due on day 5.
Day 7, no client_reply since approval: set case status to parked.
A client_reply recorded at any point cancels open tasks for that case and stops further rules.
Tasks are computed on read by the endpoint that lists them, and written idempotently, so repeated reads create no duplicates.

Metrics: cycle time per requirement = received_on minus requested_on, in days, for received requirements. Pilot median is the median across those values. Rounds per case = count of requested events for the case. Baseline values come from configuration: BASELINE_MEDIAN_DAYS=17 and BASELINE_ROUNDS=3.

## 7. Draft service

Model: Gemini via @google/genai. Default model GEMINI_MODEL=gemini-2.5-flash. Temperature 0.3. Timeout 8 seconds, enforced by an AbortController and a Promise.race fallback.

System prompt, stored as a constant in draftService.ts:
"You write a client request email for a bank onboarding team. Use only the items in the gap list provided. Do not add, remove, or infer requirements. Do not judge whether any document is genuine, authentic, or fraudulent. List each item once on its own line with its reason. Include exactly one response date. Use a courteous tone and active voice. Keep the body under 150 words. Do not name any internal rule, score, or system. End with the RM name. Output a subject line and a body only."

Input to the model is structured JSON: client name, RM name, items with labels and reasons, and the response date. The model response is validated: it must contain the subject and body, must mention every item label exactly once, and must contain one date. If validation fails, the template is used.

Template fallback: deterministic text built from the same gap list, with the same validation. It always passes validation.

Errors: missing key, timeout, network error, and failed validation all return source="template". The error category is logged without the key or the prompt contents.

## 8. API

GET /api/cases: list cases with open gap count and status.
GET /api/cases/:id: case detail with requirements and saved draft, when present.
GET /api/cases/:id/gaps: gap list grouped as missing, needs_resubmission, received.
POST /api/cases/:id/draft: generate a draft from the current gap list. Returns subject, body, source.
PUT /api/cases/:id/draft: save RM edits. Sets edited to true when the text differs from the last saved draft.
POST /api/cases/:id/approve: records the approved event and approved_on (as-of date), sets status to awaiting_client, records a requested event at the RM mailto handoff for cycle-time tracking, and returns a mailto URL built from the saved draft. Makes no network call to anyone. The prototype cannot verify that the RM sent or delivered the message.
POST /api/cases/:id/hold: records an RM hold for review; does not approve or send.
POST /api/demo/documents/:docId/receive: records a received event and document. Demo control only.
POST /api/demo/as-of: sets the as-of date for the session. Demo control only.
GET /api/demo/as-of: returns the current session as-of date for the demo control.
POST /api/demo/cases/:id/reply: records a synthetic client reply so follow-up cancellation can be demonstrated.
GET /api/tasks: tasks due on or before the as-of date, after the follow-up engine runs.
POST /api/tasks/:id/done: marks a task done.
GET /api/metrics: baseline, pilot median, and rounds per case.

Errors use a single shape: { error: { code, message } }. No stack traces in responses outside development.

## 9. Configuration

Read from .env by dotenv:
GEMINI_API_KEY (may be empty; empty triggers template mode; GOOGLE_API_KEY is an accepted fallback)
GEMINI_MODEL (default gemini-2.5-flash)
DATABASE_URL (default file:./data/chaser.db)
AS_OF_DATE (default 2026-11-12)
BASELINE_MEDIAN_DAYS (default 17)
BASELINE_ROUNDS (default 3)
PORT (default 8787)

The server binds to 127.0.0.1 only. Logs never include environment values or request bodies.

## 10. Frontend

Five screens from the Stitch export: case queue, case detail, RM review, follow-up tracker, and metrics. Tokens come from design/ and are represented in frontend/src/styles/tokens.css. Layout uses a 16px gutter at phone widths and no horizontal scroll. The header shows "Synthetic data". The RM review screen shows the gap reasons, an editable draft, and the actions Approve and send, Edit, and Hold. The banner "Nothing is sent automatically" appears on that screen. Unsupported mockup claims and mock features are omitted.

The mailto link is built with encodeURIComponent for subject and body.

## 11. Security and compliance

The API key lives only in .env and is read only by geminiClient.ts. It is never serialised into a response, a log line, or a bundled asset. A test checks that the built web bundle does not contain the key value.

No authentication, because the app is single-user and local. This is a stated limit, not an oversight.

All client text is synthetic. The app never calls an external service other than Gemini for draft text.

## 12. Testing

Server unit tests (Vitest): gap engine for missing, expired, illegible, and 90-day register cases; follow-up boundaries at days 2, 3, 5, and 7, plus reply cancellation; metrics median; template fallback with the key unset, and fallback on forced timeout.

Server API tests (Vitest with supertest): endpoint happy paths, including hold and reply demo controls. The approve test replaces global fetch with a spy and asserts zero calls. Idempotent task creation on repeated reads.

Web tests (Vitest with Testing Library): one smoke render per screen with mocked API responses.

Bundle check: the built web assets must not contain GEMINI_API_KEY's value.

## 13. Decisions

Rules in code, not in the model. Gap and follow-up decisions must be explainable and repeatable. The model writes text only.

TypeScript end to end. One language for server, web, and shared types. A shared types package is not used at this size; types are duplicated in a thin web/src/api/types.ts, checked by the API tests.

SQLite with Drizzle. Single-user demo, no database server. The checked-in migration avoids a schema-generation CLI dependency at runtime.

Express over Fastify. Familiar to most teams and the smaller dependency surface for this scope.

Tasks computed on read. No background scheduler in the prototype, so the demo can move through time.

Template fallback. The demo must run offline and without a key.

## 14. Open questions

The Stitch design folder path and format were not inspected for this version. Confirm whether it contains HTML, React, or only tokens and images, since that changes how much frontend code is reused.

Pilot median target, set after the first measured cohort.

Whether the RM's mail client handoff is replaced by an integrated channel in a later phase. Out of scope for the prototype.
