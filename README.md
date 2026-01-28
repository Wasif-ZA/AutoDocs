# AutoDocs

Automatically generate comprehensive documentation for React components using AI.

## Features

- **AST-Powered Extraction**: Uses TypeScript's AST to accurately extract component props, types, and metadata
- **AI-Generated Documentation**: Leverages Claude to generate descriptions, usage examples, and accessibility notes
- **Intelligent Caching**: File-hash based caching with TTL to minimize API calls
- **Security First**: Pattern-based sanitization to prevent sensitive data leaks
- **Production Ready**: Rate limiting, retry logic, parallel processing, and comprehensive error handling
- **Flexible Output**: Supports MDX, Markdown, and JSON output formats
- **CI/CD Integration**: GitHub Actions workflow with PR creation and suggestions

## Installation

```bash
pnpm install
```

## Configuration

Create an `autodocs.config.ts` file in your project root:

```typescript
import type { Config } from './scripts/autodocs/config/schema';

const config: Partial<Config> = {
  paths: {
    components: 'src/components',
    docs: 'pages/docs/components',
  },
  patterns: {
    include: ['**/*.tsx'],
    exclude: ['**/*.stories.tsx', '**/*.test.tsx'],
  },
  llm: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  },
  output: {
    format: 'mdx',
    includeSourceLink: true,
  },
};

export default config;
```

## Usage

### Generate Documentation

```bash
# Generate docs for all components
pnpm autodocs generate

# Incremental mode (only changed files)
pnpm autodocs generate --incremental

# Dry run (preview without writing)
pnpm autodocs generate --dry-run

# With validation
pnpm autodocs generate --validate

# Verbose logging
pnpm autodocs generate --verbose
```

### Cache Management

```bash
# Show cache statistics
pnpm autodocs cache --stats

# Clear cache
pnpm autodocs cache --clear
```

### Validate Component

```bash
# Validate AST extraction for a single file
pnpm autodocs validate src/components/Button.tsx
```

### Initialize Configuration

```bash
# Create default configuration file
pnpm autodocs init
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes |

## Architecture

```
scripts/autodocs/
├── config/           # Configuration system with Zod validation
├── core/             # Core modules (extract, llm, render, validate)
├── utils/            # Utilities (cache, logger, security, concurrency)
├── cli/              # CLI commands
└── __tests__/        # Test suite
```

## Output Format

Generated documentation includes:

- Component description and category
- Props table with types, defaults, and descriptions
- Usage examples with live code
- Accessibility notes (ARIA, keyboard navigation)
- Best practices (do's and don'ts)
- Improvement suggestions

## CI/CD Integration

The included GitHub Actions workflow:

1. Triggers on pushes to `src/components/`
2. Generates documentation incrementally
3. Creates a PR with documentation updates
4. Comments on PRs with suggestions

## Testing

```bash
# Run tests
pnpm test

# Run tests once
pnpm test:run

# Type check
pnpm typecheck
```

## License

MIT
