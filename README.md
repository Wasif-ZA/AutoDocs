# AutoDocs

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-CI-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-Compatible-412991?logo=openai&logoColor=white)](https://platform.openai.com/)

Generate high-signal markdown docs from TypeScript and TSX source files using AST extraction plus schema-validated LLM output.

## Problem Statement
Engineering teams ship APIs and components faster than they can maintain docs. Manual documentation drifts, examples become stale, and code review velocity drops. AutoDocs automates source-to-doc generation so references stay current and enforceable.

## Pipeline
```mermaid
flowchart TD
    A[Source Code] --> B[AST Parser]
    B --> C[Prompt Constructor]
    C --> D[Token-aware Chunker]
    D --> E[LLM API]
    E --> F[Schema Validator]
    F --> G[Markdown Writer]
```

### Incremental changed-file detection
```mermaid
flowchart TD
    S[Start Run] --> H[Hash Input Files]
    H --> C{Hash changed since last run?}
    C -- No --> K[Skip file]
    C -- Yes --> P[Parse + Generate + Validate + Write]
    P --> U[Persist new hash]
    K --> N{More files?}
    U --> N
    N -- Yes --> C
    N -- No --> E[End Run]
```

## Engineering Decisions
- **AST over raw text**: preserves signatures, types, and export intent instead of heuristic parsing.
- **Token-aware chunking**: keeps prompts within model limits while retaining semantic boundaries.
- **JSON schema validation + retry**: invalid model responses are rejected and regenerated deterministically.
- **Incremental file hashing**: unchanged files skip expensive generation work.
- **Docker containerisation**: reproducible CI execution and environment parity across machines.

## Quick Start
### 1) Install
```bash
npm install
```

### 2) Run mock mode
```bash
npm run build
node dist/index.js --mock ./examples/sample-input
```

### 3) GitHub Actions snippet
```yaml
- name: Build
  run: npm run build

- name: Generate docs in mock mode
  run: node dist/index.js --mock ./examples/sample-input
```

### 4) Required environment variables
| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | Yes (live mode) | Auth for model calls when mock mode is disabled. |
| `AUTODOCS_MODEL` | No | Override default model identifier. |
| `AUTODOCS_OUTPUT_DIR` | No | Override docs output directory. |

## Before / After
### Before
```ts
export const truncate = (input: string, maxLength: number): string => {
  const symbols = Array.from(input);
  if (symbols.length <= maxLength) return input;
  return `${symbols.slice(0, maxLength - 1).join('')}…`;
};
```

### After
```md
### truncate(input, maxLength)
Truncates by Unicode symbols and appends an ellipsis when clipping is required.

| Parameter | Type | Description |
| --- | --- | --- |
| input | string | String to shorten safely. |
| maxLength | number | Max symbol length including ellipsis. |
```

## Architecture Overview
- `parser/`: AST traversal and typed symbol extraction.
- `prompt/`: deterministic prompt assembly and context shaping.
- `llm/`: provider adapters and retry orchestration.
- `validator/`: response schema checks and structured error surfaces.
- `writer/`: markdown rendering and file emission.
- `cli/`: command parsing, mode selection, and execution lifecycle.

## Roadmap
1. Add provider failover across multiple model backends with health scoring.
2. Generate framework-specific examples (React, Node, and SDK clients) from one schema.
3. Publish a prebuilt Docker image with pinned runtime and default workflow templates.
