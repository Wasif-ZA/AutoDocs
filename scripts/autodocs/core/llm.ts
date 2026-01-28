import Anthropic from '@anthropic-ai/sdk';
import { Config, ComponentDoc, ComponentDocSchema, ASTExtractionResult } from '../config/schema.js';
import { DocumentationCache } from '../utils/cache.js';
import { SecuritySanitizer } from '../utils/security.js';
import { RateLimiter, withRetry } from '../utils/concurrency.js';
import { logger } from '../utils/logger.js';

export class DocumentationGenerator {
  private client: Anthropic;
  private config: Config;
  private cache: DocumentationCache;
  private sanitizer: SecuritySanitizer;
  private rateLimiter: RateLimiter;

  constructor(config: Config) {
    this.config = config;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: config.llm.timeout,
    });
    this.cache = new DocumentationCache(config.paths.cache);
    this.sanitizer = new SecuritySanitizer(config.security);
    this.rateLimiter = new RateLimiter(config.llm.rateLimit);
  }

  async init(): Promise<void> {
    await this.cache.init();
  }

  async generate(
    filePath: string,
    content: string,
    astResult: ASTExtractionResult
  ): Promise<ComponentDoc | null> {
    // Check cache first
    const cached = await this.cache.get(filePath, content, this.config.llm.model);
    if (cached) {
      logger.debug(`Cache hit for ${astResult.componentName}`);
      return cached;
    }

    // Sanitize content
    const { sanitized, redactions } = this.sanitizer.sanitize(content);
    if (redactions > 0) {
      logger.info(`Redacted ${redactions} sensitive patterns from ${astResult.componentName}`);
    }

    // Build the prompt
    const prompt = this.buildPrompt(astResult, sanitized, filePath);

    // Wait for rate limit slot
    const estimatedTokens = Math.ceil(prompt.length / 4) + this.config.llm.maxTokens;
    await this.rateLimiter.waitForSlot(estimatedTokens);

    // Call LLM with retry
    try {
      const doc = await withRetry(
        () => this.callLLM(prompt, astResult.componentName),
        {
          retries: this.config.llm.retries,
          delay: this.config.llm.retryDelay,
          shouldRetry: (error) => {
            // Retry on rate limits and transient errors
            const message = error.message.toLowerCase();
            return (
              message.includes('rate') ||
              message.includes('timeout') ||
              message.includes('503') ||
              message.includes('529')
            );
          },
        }
      );

      if (doc) {
        // Enrich with metadata
        doc.metadata = {
          confidence: this.calculateConfidence(astResult, doc),
          astParsed: astResult.astSuccess,
          sourceFile: filePath,
          generatedAt: new Date().toISOString(),
          modelVersion: this.config.llm.model,
        };

        // Cache the result
        await this.cache.set(filePath, content, this.config.llm.model, doc);
      }

      return doc;
    } catch (error) {
      logger.error(`Failed to generate docs for ${astResult.componentName}`, {
        error: (error as Error).message,
      });
      return null;
    }
  }

  private buildPrompt(ast: ASTExtractionResult, content: string, filePath: string): string {
    // Build AST context to help the LLM
    const astContext = ast.astSuccess
      ? `
## Pre-extracted Information (verified by AST):
- Component Name: ${ast.componentName}
- Export Type: ${ast.exportType}
- Uses forwardRef: ${ast.isForwardRef}
- Uses memo: ${ast.isMemo}
- Is HOC wrapped: ${ast.isHOC}
- Hooks used: ${ast.hooks.join(', ') || 'None detected'}
- Props (from TypeScript):
${ast.props.map(p => `  - ${p.name}: ${p.type}${p.required ? ' (required)' : ''}${p.jsDoc ? ` - ${p.jsDoc}` : ''}`).join('\n') || '  None extracted'}
- Related imports: ${ast.imports.filter(i => i.isRelative).map(i => i.source).join(', ') || 'None'}

Use this information as ground truth. Only add props you can verify from the code.
`
      : `
## Note: AST extraction failed
Errors: ${ast.astErrors.join('; ')}
You must infer the component structure from the code. Mark confidence accordingly.
`;

    return `You are a technical documentation engine for React components. Generate comprehensive, accurate documentation.

${astContext}

## Output Schema (respond with ONLY this JSON structure, no markdown):
{
  "name": "ComponentName",
  "displayName": "Human Readable Name (optional)",
  "description": "One paragraph describing the component's purpose and use case",
  "category": "forms|layout|navigation|feedback|data-display|utility",

  "props": [
    {
      "name": "propName",
      "type": "TypeScript type (simplified for readability)",
      "required": true,
      "defaultValue": "value or null",
      "description": "What this prop does",
      "deprecated": false,
      "since": "1.0.0 (if known)"
    }
  ],

  "slots": [
    { "name": "children", "description": "Main content" }
  ],

  "events": [
    { "name": "onChange", "description": "Fired when value changes", "payload": "(value: string) => void" }
  ],

  "usage": [
    {
      "title": "Basic Usage",
      "description": "The simplest way to use this component",
      "code": "import { ${ast.componentName} } from '@/components/...';\n\n<${ast.componentName} />",
      "language": "tsx",
      "live": false
    },
    {
      "title": "With Props",
      "description": "Common configuration",
      "code": "...",
      "language": "tsx",
      "live": true
    }
  ],

  "accessibility": {
    "role": "button|dialog|etc (if applicable)",
    "aria": ["aria-label required when no visible text"],
    "keyboard": [
      { "key": "Enter", "action": "Activates the component" }
    ],
    "notes": ["Screen reader announcements", "Focus management notes"]
  },

  "bestPractices": [
    { "do": "Use descriptive labels", "dont": "Use placeholder as label" }
  ],

  "suggestions": [
    {
      "priority": "low|medium|high|critical",
      "category": "performance|accessibility|maintainability|security|testing",
      "message": "Consider adding aria-label for better accessibility",
      "line": 42,
      "autofix": "aria-label={label}"
    }
  ]
}

## Rules:
1. ONLY document props that are explicitly defined in the code. Never invent props.
2. If the code uses TypeScript, respect the exact types defined.
3. Generate 2-4 usage examples showing real-world scenarios.
4. Accessibility notes should be actionable and specific.
5. Suggestions should be constructive improvements, not criticisms.
6. If something is unclear, note it in the description rather than guessing.

## Source Code (${filePath}):
\`\`\`tsx
${content}
\`\`\`

Respond with ONLY the JSON object. No explanations, no markdown fencing.`;
  }

  private async callLLM(prompt: string, componentName: string): Promise<ComponentDoc | null> {
    const startTime = Date.now();

    const response = await this.client.messages.create({
      model: this.config.llm.model,
      max_tokens: this.config.llm.maxTokens,
      temperature: this.config.llm.temperature,
      messages: [{ role: 'user', content: prompt }],
    });

    const duration = Date.now() - startTime;
    const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    this.rateLimiter.recordRequest(tokens);
    logger.debug(`LLM call for ${componentName} completed`, { duration, tokens });

    // Extract text content
    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text content in response');
    }

    // Parse and validate
    try {
      // Clean potential markdown fencing
      let text = textBlock.text.trim();
      if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const json = JSON.parse(text);
      return ComponentDocSchema.parse(json);
    } catch (error) {
      logger.warn(`Failed to parse LLM response for ${componentName}`, {
        error: (error as Error).message,
        response: textBlock.text.slice(0, 200),
      });
      throw error;
    }
  }

  private calculateConfidence(ast: ASTExtractionResult, doc: ComponentDoc): number {
    let confidence = 0.5; // Base confidence

    // AST success is a big boost
    if (ast.astSuccess) {
      confidence += 0.2;

      // Verify props match
      const astPropNames = new Set(ast.props.map(p => p.name));
      const docPropNames = new Set(doc.props.map(p => p.name));

      const intersection = [...astPropNames].filter(x => docPropNames.has(x)).length;
      const union = new Set([...astPropNames, ...docPropNames]).size;

      if (union > 0) {
        const propOverlap = intersection / union;
        confidence += propOverlap * 0.2;
      }
    }

    // Good documentation markers
    if (doc.usage.length >= 2) confidence += 0.05;
    if (doc.accessibility.notes.length >= 2) confidence += 0.05;
    if (doc.description.length > 50) confidence += 0.05;

    return Math.min(confidence, 1);
  }

  getCacheStats(): { total: number; sizeKB: number } {
    return this.cache.getStats();
  }

  async clearCache(): Promise<void> {
    await this.cache.invalidateAll();
  }
}
