import { describe, it, expect } from 'vitest';
import { SecuritySanitizer } from '../utils/security.js';
import { ConfigSchema } from '../config/schema.js';

describe('SecuritySanitizer', () => {
  const config = ConfigSchema.parse({});
  const sanitizer = new SecuritySanitizer(config.security);


  it('redacts API keys', () => {
    const content = `
      const apiKey = "sk-1234567890abcdef";
      const client = new Anthropic({ apiKey });
    `;

    const { sanitized, redactions } = sanitizer.sanitize(content);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('sk-1234567890abcdef');
    expect(redactions).toBeGreaterThan(0);
  });

  it('redacts GitHub tokens', () => {
    const content = `
      const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
    `;

    const { sanitized, redactions } = sanitizer.sanitize(content);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('ghp_');
    expect(redactions).toBe(1);
  });

  it('redacts process.env references', () => {
    const content = `
      const apiKey = process.env.ANTHROPIC_API_KEY;
      const secret = process.env.SECRET_KEY;
    `;

    const { sanitized, redactions } = sanitizer.sanitize(content);

    expect(sanitized).toContain('[REDACTED]');
    expect(redactions).toBe(2);
  });

  it('redacts Bearer tokens', () => {
    const content = `
      headers: {
        Authorization: "Bearer abc123def456"
      }
    `;

    const { sanitized, redactions } = sanitizer.sanitize(content);

    expect(sanitized).toContain('[REDACTED]');
    expect(redactions).toBe(1);
  });

  it('removes sensitive comments', () => {
    const content = `
      // TODO: fix this later
      // password: admin123
      // secret key is abc
    `;

    const { sanitized } = sanitizer.sanitize(content);

    expect(sanitized).toContain('[COMMENT REMOVED]');
    expect(sanitized).toContain('[SENSITIVE COMMENT REMOVED]');
    expect(sanitized).not.toContain('admin123');
  });

  it('preserves JSDoc comments', () => {
    const content = `
      /**
       * Button component
       * @param props - Component props
       */
      export function Button(props) {
        return <button>{props.label}</button>;
      }
    `;

    const { sanitized } = sanitizer.sanitize(content);

    expect(sanitized).toContain('Button component');
    expect(sanitized).toContain('@param props');
  });

  it('truncates long content', () => {
    const longContent = 'x'.repeat(30000);
    const customSanitizer = new SecuritySanitizer({
      ...config.security,
      maxFileChars: 1000,
    });

    const { sanitized } = customSanitizer.sanitize(longContent);

    expect(sanitized.length).toBeLessThan(longContent.length);
    expect(sanitized).toContain('[TRUNCATED FOR SECURITY]');
  });

  it('validates output for dangerous patterns', () => {
    const dangerousCode = `
      eval("alert('xss')");
      document.write('<script>');
      element.innerHTML = userInput;
    `;

    const { valid, issues } = sanitizer.validateOutput(dangerousCode);

    expect(valid).toBe(false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(i => i.includes('eval'))).toBe(true);
    expect(issues.some(i => i.includes('innerHTML'))).toBe(true);
  });

  it('passes validation for safe code', () => {
    const safeCode = `
      export function Button({ label, onClick }) {
        return (
          <button onClick={onClick}>
            {label}
          </button>
        );
      }
    `;

    const { valid, issues } = sanitizer.validateOutput(safeCode);

    expect(valid).toBe(true);
    expect(issues).toHaveLength(0);
  });
});
