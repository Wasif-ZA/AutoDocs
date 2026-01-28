import type { Config } from './scripts/autodocs/config/schema.js';

// DeepPartial makes all nested properties optional, matching Zod's runtime defaults
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const config: DeepPartial<Config> = {
  paths: {
    // In CI, look for components in the sibling directory created by GitHub Actions
    // Locally, use the default path. This can also be overridden via CLI --overrides flag.
    components: process.env.CI ? '../external-source/src/components' : 'src/components',
    docs: 'pages/docs/components',
    suggestions: '.autodocs/suggestions.json',
    cache: '.autodocs/cache',
  },
  patterns: {
    include: ['**/*.tsx'],
    exclude: [
      '**/*.stories.tsx',
      '**/*.test.tsx',
      '**/internal/**',
    ],
  },
  llm: {
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
  },
  output: {
    format: 'mdx',
    includeSourceLink: true,
  },
  features: {
    extractFromStories: true,
    validateCodeExamples: true,
  },
};

export default config;
