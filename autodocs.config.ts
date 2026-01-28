import type { Config } from './scripts/autodocs/config/schema.js';

const config: Partial<Config> = {
  paths: {
    components: 'src/components',
    docs: 'pages/docs/components',
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
