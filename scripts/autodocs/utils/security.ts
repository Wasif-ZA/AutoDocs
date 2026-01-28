import { Config } from '../config/schema.js';

export class SecuritySanitizer {
  private patterns: RegExp[];
  private maxChars: number;

  constructor(config: Config['security']) {
    this.patterns = config.stripPatterns.map(p => new RegExp(p, 'gi'));
    this.maxChars = config.maxFileChars;
  }

  sanitize(content: string): { sanitized: string; redactions: number } {
    let redactions = 0;
    let result = content;

    // Apply all strip patterns
    for (const pattern of this.patterns) {
      const matches = result.match(pattern);
      if (matches) {
        redactions += matches.length;
        result = result.replace(pattern, '[REDACTED]');
      }
    }

    // Additional security measures
    result = this.stripSensitiveComments(result);
    result = this.truncate(result);

    return { sanitized: result, redactions };
  }

  private stripSensitiveComments(content: string): string {
    // Remove comments that might contain sensitive info
    // But preserve JSDoc comments (they're useful for docs)
    return content
      .replace(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG):?.*$/gm, '// [COMMENT REMOVED]')
      .replace(/\/\/.*?(password|secret|key|token|auth).*$/gmi, '// [SENSITIVE COMMENT REMOVED]');
  }

  private truncate(content: string): string {
    if (content.length <= this.maxChars) {
      return content;
    }

    // Smart truncation: keep the beginning (imports, types) and component definition
    const half = Math.floor(this.maxChars / 2);
    return (
      content.slice(0, half) +
      '\n\n/* ... [TRUNCATED FOR SECURITY] ... */\n\n' +
      content.slice(-half)
    );
  }

  // Validate that generated code doesn't contain anything suspicious
  validateOutput(code: string): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for potential injection patterns
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /document\.write/,
      /innerHTML\s*=/,
      /dangerouslySetInnerHTML/,
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // onclick, onerror, etc.
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(`Potentially dangerous pattern detected: ${pattern.source}`);
      }
    }

    return { valid: issues.length === 0, issues };
  }
}
