# Saarthi UI + Research Fix

## UI sequence
The navigation now follows the user's decision journey:
1. My Money — what is happening?
2. Understand — why is it happening?
3. Decide — what should I do?
4. Research — what does the outside world say?
5. Data — import/inspect
6. Transactions — supporting ledger detail

The home screen now leads with the SEE → UNDERSTAND → DECIDE → VERIFY journey and natural-language questions rather than exposing backend features as the primary navigation.

## Research
- `.env` loading works whether the server is started from `phase9work/` or its parent directory.
- Research status reports configuration and model state.
- Research uses the Responses API `web_search` tool.
- Web-search source extraction now handles nested URL-citation annotations as well as search-call source lists.
- Research requests have a 45-second timeout and clearer failure messages.
- The UI shows live readiness, source count, source type, and actionable backend errors.
- The project default port is consistently documented as 3000.

## Verification
Run:
```bash
npm install
npm test
npm run check
npm start
```

Then open:
`http://localhost:3000`

Set `OPENAI_API_KEY` in `phase9work/.env` and restart the backend before testing Research.
