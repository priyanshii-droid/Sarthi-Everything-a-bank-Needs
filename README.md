# Saarthi — Financial Intelligence Foundation

This build is the Phase 0 foundation reset for Saarthi. The project is now organized so the financial reasoning engine, parser, AI layer, shared configuration/error handling, and API layer have clear boundaries.

## Run

```bash
npm install
npm start
```

Then open `http://localhost:3001`.

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
