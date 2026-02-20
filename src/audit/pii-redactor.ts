/**
 * PII Redaction for Audit Logs
 *
 * Detects and masks sensitive patterns in logged parameters:
 * - SSN (Social Security Numbers)
 * - Credit card numbers
 * - Email addresses
 * - Phone numbers
 * - IP addresses (optional)
 */

export interface RedactionPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

export const DEFAULT_REDACTION_PATTERNS: RedactionPattern[] = [
  {
    name: 'API_KEY',
    // Common API key patterns (sk_, pk_, etc.) - check before phone numbers
    regex: /\b(?:sk|pk|key|api|token)_[a-zA-Z0-9_]{16,}\b/gi,
    replacement: '[API_KEY_REDACTED]',
  },
  {
    name: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: '***-**-****',
  },
  {
    name: 'SSN_NO_DASHES',
    regex: /\b\d{9}\b/g,
    replacement: '*********',
  },
  {
    name: 'CREDIT_CARD',
    // Matches common credit card formats (Visa, MC, Amex, Discover)
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '****-****-****-****',
  },
  {
    name: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    name: 'PHONE',
    regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
];

export class PIIRedactor {
  private patterns: RedactionPattern[];

  constructor(customPatterns?: RedactionPattern[]) {
    this.patterns = customPatterns || DEFAULT_REDACTION_PATTERNS;
  }

  /**
   * Redact PII from a string value
   */
  redactString(value: string): string {
    let redacted = value;
    for (const pattern of this.patterns) {
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
    return redacted;
  }

  /**
   * Recursively redact PII from an object
   */
  redactObject(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.redactString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactObject(item));
    }

    if (typeof obj === 'object') {
      const redacted: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip known sensitive keys entirely
        if (this.isSensitiveKey(key)) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redactObject(value);
        }
      }
      return redacted;
    }

    return obj;
  }

  /**
   * Check if a key name indicates sensitive data
   */
  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /api[_-]?key/i,
      /auth/i,
      /credential/i,
      /private[_-]?key/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(key));
  }

  /**
   * Add custom redaction pattern
   */
  addPattern(pattern: RedactionPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Remove pattern by name
   */
  removePattern(name: string): void {
    this.patterns = this.patterns.filter((p) => p.name !== name);
  }
}

// Singleton instance
export const defaultRedactor = new PIIRedactor();
