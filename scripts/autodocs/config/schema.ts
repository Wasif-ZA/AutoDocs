import { z } from 'zod';

// Strict schema for runtime validation
export const ConfigSchema = z.object({
  root: z.string().default(process.cwd()),

  paths: z.object({
    components: z.string().default('src/components'),
    docs: z.string().default('pages/docs/components'),
    suggestions: z.string().default('.autodocs/suggestions.json'),
    cache: z.string().default('.autodocs/cache'),
    templates: z.string().optional(),
  }).default({}),

  patterns: z.object({
    include: z.array(z.string()).default(['**/*.tsx', '**/*.jsx']),
    exclude: z.array(z.string()).default([
      '**/*.stories.tsx',
      '**/*.test.tsx',
      '**/*.spec.tsx',
      '**/index.ts',
      '**/index.tsx',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/node_modules/**',
    ]),
  }).default({}),

  llm: z.object({
    model: z.string().default('claude-sonnet-4-20250514'),
    maxTokens: z.number().default(4096),
    temperature: z.number().min(0).max(1).default(0),
    retries: z.number().default(3),
    retryDelay: z.number().default(1000), // ms
    timeout: z.number().default(60000), // ms
    rateLimit: z.object({
      requestsPerMinute: z.number().default(50),
      tokensPerMinute: z.number().default(100000),
    }).default({}),
  }).default({}),

  security: z.object({
    maxFileChars: z.number().default(25000),
    stripPatterns: z.array(z.string()).default([
      'process\\.env\\.\\w+',
      '[\'"]sk-[\\w-]+[\'"]',
      '[\'"]ghp_[\\w]+[\'"]',
      '[\'"]npm_[\\w]+[\'"]',
      'Bearer\\s+[\\w-]+',
    ]),
    allowedImports: z.array(z.string()).optional(), // Whitelist
  }).default({}),

  output: z.object({
    format: z.enum(['mdx', 'md', 'json']).default('mdx'),
    frontmatter: z.boolean().default(true),
    includeSourceLink: z.boolean().default(true),
    includeTimestamp: z.boolean().default(true),
    reliability: z.enum(['show', 'hide']).default('show'),
  }).default({}),

  features: z.object({
    extractFromStories: z.boolean().default(true),
    validateCodeExamples: z.boolean().default(true),
    generateChangelog: z.boolean().default(false),
    watchMode: z.boolean().default(false),
  }).default({}),

  ci: z.object({
    commitMessage: z.string().default('docs: auto-generated update [skip ci]'),
    branch: z.string().default('main'),
    createPR: z.boolean().default(false),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

// Component documentation schema (what LLM outputs)
export const ComponentDocSchema = z.object({
  name: z.string(),
  displayName: z.string().optional(),
  description: z.string(),
  category: z.string().optional(),

  props: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
    description: z.string(),
    deprecated: z.boolean().optional(),
    since: z.string().optional(), // Version
  })),

  slots: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })).optional(),

  events: z.array(z.object({
    name: z.string(),
    description: z.string(),
    payload: z.string().optional(),
  })).optional(),

  usage: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    code: z.string(),
    language: z.string().default('tsx'),
    live: z.boolean().default(false), // For live code editors
  })),

  accessibility: z.object({
    role: z.string().optional(),
    aria: z.array(z.string()).optional(),
    keyboard: z.array(z.object({
      key: z.string(),
      action: z.string(),
    })).optional(),
    notes: z.array(z.string()),
  }),

  bestPractices: z.array(z.object({
    do: z.string(),
    dont: z.string().optional(),
  })).optional(),

  suggestions: z.array(z.object({
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    category: z.enum(['performance', 'accessibility', 'maintainability', 'security', 'testing']),
    message: z.string(),
    line: z.number().optional(),
    autofix: z.string().optional(), // Suggested code fix
  })),

  metadata: z.object({
    confidence: z.number().min(0).max(1),
    astParsed: z.boolean(),
    sourceFile: z.string(),
    generatedAt: z.string(),
    modelVersion: z.string(),
  }),
});

export type ComponentDoc = z.infer<typeof ComponentDocSchema>;

// Extraction result from AST
export interface ASTExtractionResult {
  componentName: string;
  exportType: 'default' | 'named' | 'both';
  isForwardRef: boolean;
  isMemo: boolean;
  isHOC: boolean;

  props: Array<{
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
    jsDoc?: string;
  }>;

  imports: Array<{
    source: string;
    specifiers: string[];
    isRelative: boolean;
  }>;

  hooks: string[];
  jsDoc?: {
    description?: string;
    tags: Record<string, string>;
  };

  astSuccess: boolean;
  astErrors: string[];
}
