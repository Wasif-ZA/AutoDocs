import type { Config } from './scripts/autodocs/config/schema.js';

// DeepPartial makes all nested properties optional, matching Zod's runtime defaults
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

const config: DeepPartial<Config> = {
  paths: {
    // Points to the root of the source code so the glob can reach everything
    components: process.env.CI ? '../external-source/code' : './code',
    docs: 'pages/docs/components',
    suggestions: '.autodocs/suggestions.json',
    cache: '.autodocs/cache',
  },
  patterns: {
    // The '**' pattern ensures it looks inside all template subfolders
    include: [
      '**/components/**/*.tsx',
      '**/templates/**/*.tsx'
    ],
    exclude: [
      '**/*.stories.tsx',
      '**/*.test.tsx',
      '**/node_modules/**',
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
