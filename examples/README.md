# AutoDocs Examples

This directory demonstrates how AutoDocs transforms strongly-typed TypeScript and React modules into structured reference documentation.

## What the input files demonstrate
- `sample-input/stringUtils.ts`: Unicode-safe string and date utility functions with parameter validation.
- `sample-input/ApiClient.ts`: Generic HTTP client abstraction with timeout control, retries, and typed API errors.
- `sample-input/UserService.ts`: Domain service using dependency injection and error translation.
- `sample-input/UserCard.tsx`: Dashboard-style React component with loading and failure states.

## What AutoDocs generated
- `sample-output/*.md`: API-style markdown references for each module.
- `mock-responses.json`: Deterministic mock-mode responses keyed by source filename for repeatable local demos.

## Run in mock mode
```bash
npm run build
node dist/index.js --mock ./examples/sample-input
```

Use this flow to evaluate extraction, rendering, and formatting behavior without external LLM calls.
