# Saarthi — Financial Intelligence

Saarthi is a financial-intelligence workspace built around a canonical ledger, deterministic financial calculations, investigation/evidence verification, decision simulation, research, document intelligence, authentication and persistent user state.

## Product flow

Saarthi is intentionally organized around the user's financial journey:

1. **My Data** — load the financial facts.
2. **My Money** — see the current financial picture.
3. **Understand** — audit, investigate and verify what is happening.
4. **Spending** — inspect the canonical ledger.
5. **Decide** — run Digital Twin scenarios without changing real data.
6. **Research** — bring current public information and cited sources into the decision.

The user can also skip the sequence and ask Saarthi directly in natural language.

## Requirements

- Node.js **22+**
- npm
- An OpenAI API key for live web research and optional AI reasoning

## Local deployment

```bash
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

The server reads `.env` automatically. Restart `npm start` after changing environment variables.

### OpenAI configuration

Set:

```env
OPENAI_API_KEY=your_real_key
SAARTHI_MODEL=gpt-5.6-luna
```

The live Research sector uses the OpenAI Responses API with web search. Without `OPENAI_API_KEY`, deterministic financial features still work, but live web research and optional AI reasoning are unavailable.

The configured model is `gpt-5.6-luna`, which supports web search through the Responses API. Always keep the API key on the backend; never put it in browser JavaScript or commit it to source control.

## Production configuration

At minimum set:

```env
PORT=3000
OPENAI_API_KEY=...
SAARTHI_MODEL=gpt-5.6-luna
SAARTHI_DEMO_MODE=false
SAARTHI_CORS_ORIGIN=https://your-production-domain.example
SAARTHI_RATE_LIMIT=120
SAARTHI_AUTH_SESSION_DAYS=30
```

For a real deployment, put Saarthi behind HTTPS and a reverse proxy, keep `.env` outside source control, use persistent storage/backups for the SQLite database, and configure the production CORS origin explicitly.

## Research diagnostics

The frontend Research sector checks `/api/research/status` before running a search.

If research fails, the backend now preserves the actual provider error instead of hiding it behind a generic UI failure. The research agent also extracts source URLs from web-search source objects and URL citation annotations and returns deduplicated source cards.

Research answers are intentionally separated from the user's private financial facts. Saarthi is instructed to prefer primary/official sources for financial rules and not invent rates, fees, eligibility, deadlines or product terms.

## Security boundaries

Saarthi does not require or request:

- OTPs
- PINs
- CVVs
- banking passwords
- full card numbers

Real bank connectivity is represented by a provider boundary and is not falsely presented as an active bank integration.

## Core architecture

```text
User data
   ↓
Canonical Ledger
   ↓
Financial Engine
   ↓
Investigation Planner / Orchestrator
   ↓
Evidence + Verification
   ↓
AI reasoning
   ↓
Decision Engine / Digital Twin
   ↓
Saarthi UI

External knowledge → Research Agent → cited evidence
Documents → extraction → canonical ledger/provenance
```

## Verification

Financial calculations are deterministic. The AI is not the source of truth for transaction totals or simulations.

Investigation results can be marked `verified` or `review_required` depending on evidence and verification checks.

Digital Twin simulations never mutate the real ledger.

## Tests

Run:

```bash
npm test
npm run check
```

The current build passes the complete automated test and JavaScript syntax-check suites.
