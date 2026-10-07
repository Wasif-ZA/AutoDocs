# AutoDocs Examples

This directory demonstrates how AutoDocs transforms strongly-typed TypeScript and React modules into structured reference documentation.

## What the input files demonstrate
- `sample-input/stringUtils.ts`: Unicode-safe string and date utility functions with parameter validation.
- `sample-input/ApiClient.ts`: Generic HTTP client abstraction with timeout control, retries, and typed API errors.
- `sample-input/UserService.ts`: Domain service using dependency injection and error translation.
- `sample-input/UserCard.tsx`: Dashboard-style React component with loading and failure states.

## Reference pages and mock responses
- `sample-output/*.md`: hand-written reference pages showing the target style. The tool does not write here.
- `mock-responses.json`: deterministic mock-mode responses keyed by source filename. Mock mode reads these instead of calling a model.

## Run in mock mode
```bash
npm run build
node dist/index.js --mock ./examples/sample-input --out ./docs
```

Each module becomes `docs/<module>.md`. A response that names an export the source does not have is rejected.

Use this flow to evaluate extraction, rendering, and formatting behavior without external LLM calls.
