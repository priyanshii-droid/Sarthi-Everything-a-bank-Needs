# Saarthi — Financial Intelligence Foundation

This build is the Phase 0 foundation reset for Saarthi. The project is now organized so the financial reasoning engine, parser, AI layer, shared configuration/error handling, and API layer have clear boundaries.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3000`.

If you use AI features, set `OPENAI_API_KEY` in the backend environment. AI is optional for deterministic financial analysis.

## Structure

- `server.js` — API composition and HTTP routes
- `core/financial-engine.js` — deterministic financial calculations, audit and investigation
- `core/parser.js` — spreadsheet/text normalization helpers
- `ai/agent.js` — Saarthi AI orchestration
- `ai/tools.js` — AI tool definitions/executors
- `ai/prompts.js` — Saarthi reasoning policy
- `shared/config.js` — validated runtime configuration
- `shared/errors.js` — structured API errors
- `shared/request-id.js` — request correlation IDs
- `shared/logger.js` — structured server logging
- `tests/` — regression tests for the foundation
- `index.html`, `app.js`, `style.css` — current UI, retained while the intelligence foundation is rebuilt

## API error format

Errors use a stable envelope:

```json
{
  "ok": false,
  "error": {
    "code": "REQUEST_ERROR",
    "message": "...",
    "requestId": "..."
  }
}
```

The response also includes an `X-Request-ID` header for troubleshooting.

## Tests

```bash
npm test
npm run check
```

The tests cover financial totals/sign handling, duplicate detection, parser normalization, and configuration validation.

## Important

Do not copy individual snippets from an older Saarthi version into this project. Treat this folder as the coherent baseline and make future changes against it.


## Phase 1 — Canonical Financial Intelligence Engine

The financial data path now uses a canonical ledger rather than calculating directly from raw spreadsheet rows.

```text
RAW FILE / PASTE
    ↓
PARSER
    ↓
NORMALIZER
    ↓
VALIDATION + QUALITY FLAGS
    ↓
CANONICAL LEDGER
    ↓
RECONCILIATION
    ↓
FINANCIAL METRICS
    ↓
AUDIT / INVESTIGATION
```

Each canonical transaction carries a stable source row, direction, signed amount, absolute amount, currency, category confidence, and quality flags. The API exposes the ledger at `GET /api/ledger`. Existing `/api/analyze`, `/api/investigate`, `/api/chat`, dashboard, and simulation routes continue to consume the canonical ledger.

Run checks with:

```bash
npm test
npm run check
```


## Phase 2 — Investigation Engine + Agent Orchestration

Saarthi now separates an investigation into: intent classification → investigation plan → deterministic evidence collection → verification → AI explanation.

The `/api/investigate` endpoint returns the investigation plan, evidence trail, and verification checks. `/api/chat` uses the same orchestration before asking the AI to explain the result.

AI remains the explanation/reasoning layer; deterministic financial calculations remain in the financial engine.

## Phase 3: Decision Engine + Digital Twin

Saarthi now has a deterministic scenario engine for decision support. Scenarios are hypothetical only and never mutate the canonical ledger.

Supported scenario types:
- `income_change` — percentage increase/decrease in detected income
- `expense_change` — percentage increase/decrease in detected expenses
- `category_reduction` — reduce a detected expense category by a percentage

Endpoints:
- `POST /api/simulate` — Digital Twin simulation; supports stacked scenarios and keeps legacy category simulation compatibility.
- `POST /api/decision` — natural-language scenario parsing followed by deterministic simulation.

The agent's `run_what_if` tool now delegates to the same Digital Twin engine, so UI, API and agent calculations use one source of truth.

## Phase 4 — Evidence + Verification

The intelligence layer now maintains a stronger evidence trail for every investigation step.

- Evidence records include status, confidence, timestamp, source and a payload fingerprint.
- Tool failures are treated as failed evidence rather than successful results.
- Verification checks cash-flow consistency, latest-period savings consistency and audit structure.
- Investigations expose an evidence-quality score and a `PASS` / `REVIEW_REQUIRED` decision gate.
- The agent is instructed to disclose verification limitations and never present failed evidence as verified.
- Deterministic financial calculations remain outside the language model.


## Phase 8 — Production hardening

Phase 8 adds the runtime foundations needed before external financial-data integrations:

- persistent session state under `data/sessions.json` with atomic writes and restrictive file permissions
- cryptographically random session identifiers instead of the previous shared `default` session
- request rate limiting
- security response headers and a restrictive default Content Security Policy
- configurable CORS, proxy trust, upload size, JSON size, and demo mode
- upload extension allow-list and single-file limits
- structured data-source registry separating demo/file-import sources from the future bank-provider adapter boundary
- explicit adapter boundary for future account/transaction providers; Saarthi does not collect banking passwords, PINs, OTPs or CVVs
- persistence regression tests

### Production deployment notes

The current bank adapter is intentionally a boundary, not a live banking connector. Before production financial connectivity, add an authenticated identity layer, encrypted provider tokens, provider-specific consent/revocation flows, encrypted database storage, audit logging, secret management, and provider webhooks/reconciliation. The local JSON store is suitable for the current single-process product build, not a horizontally scaled production database.

## Phase 9 — authenticated users, database persistence, provider boundary
- Added SQLite persistence using Node's built-in `node:sqlite` runtime API (no native npm database dependency).
- Added account registration/login/logout with scrypt password hashing and opaque bearer sessions whose database values are SHA-256 token hashes.
- Financial workspace state is now persisted per authenticated user instead of browser-generated session IDs.
- Added provider registry + connection boundary for future bank/open-banking integrations. Provider adapters receive provider-issued authorization context; Saarthi never accepts banking passwords, PINs, OTPs or CVVs.
- Added provider connection APIs and regression tests.
- Demo mode creates a disposable authenticated account rather than using a shared financial session.

### Production provider rule
A real bank adapter must use the institution/provider's official consent/OAuth flow and a secure token vault/KMS. Do not add login/password/OTP/PIN/CVV fields to Saarthi APIs.

## Phase 9.1 — Language, Rewards, Settings & Research UX

- UI language switching: English, Hindi, Gujarati.
- Preferences persisted per authenticated user.
- Interface sound and spoken-response preferences.
- Share-and-earn rewards ledger (+25 points per share action).
- Research status endpoint and cited source cards.
- Live research uses the OpenAI Responses API web search tool when `OPENAI_API_KEY` is configured.
- `.env` is loaded automatically from the project root even when `npm start` is launched from the parent directory; restart `npm start` after changing it.

### Enable live research

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY=...` in `.env`.
3. Restart the backend with `npm start`.
4. Open Research in Saarthi and use a research prompt.

Never place API keys in the browser, HTML, or client-side JavaScript.
