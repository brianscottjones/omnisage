import { describe, it, expect, beforeEach } from 'vitest';
import { PIIRedactor, DEFAULT_REDACTION_PATTERNS } from '../pii-redactor.js';

describe('PIIRedactor', () => {
  let redactor: PIIRedactor;

  beforeEach(() => {
    redactor = new PIIRedactor();
  });

  describe('SSN redaction', () => {
    it('should redact SSN with dashes', () => {
      const input = 'My SSN is 123-45-6789';
      const result = redactor.redactString(input);
      expect(result).toBe('My SSN is ***-**-****');
    });

    it('should redact SSN without dashes', () => {
      const input = 'SSN: 123456789';
      const result = redactor.redactString(input);
      expect(result).toBe('SSN: *********');
    });

    it('should redact multiple SSNs', () => {
      const input = '123-45-6789 and 987-65-4321';
      const result = redactor.redactString(input);
      expect(result).toBe('***-**-**** and ***-**-****');
    });
  });

  describe('Credit card redaction', () => {
    it('should redact Visa card', () => {
      const input = 'Card: 4532-1234-5678-9010';
      const result = redactor.redactString(input);
      expect(result).toBe('Card: ****-****-****-****');
    });

    it('should redact card without dashes', () => {
      const input = 'Card: 4532123456789010';
      const result = redactor.redactString(input);
      expect(result).toBe('Card: ****-****-****-****');
    });

    it('should redact card with spaces', () => {
      const input = 'Card: 4532 1234 5678 9010';
      const result = redactor.redactString(input);
      expect(result).toBe('Card: ****-****-****-****');
    });
  });

  describe('Email redaction', () => {
    it('should redact email addresses', () => {
      const input = 'Contact me at john.doe@example.com';
      const result = redactor.redactString(input);
      expect(result).toBe('Contact me at [EMAIL_REDACTED]');
    });

    it('should redact multiple emails', () => {
      const input = 'Emails: alice@test.com, bob@example.org';
      const result = redactor.redactString(input);
      expect(result).toBe('Emails: [EMAIL_REDACTED], [EMAIL_REDACTED]');
    });
  });

  describe('Phone number redaction', () => {
    it('should redact US phone with parentheses', () => {
      const input = 'Call (123) 456-7890';
      const result = redactor.redactString(input);
      expect(result).toBe('Call [PHONE_REDACTED]');
    });

    it('should redact phone with dashes', () => {
      const input = 'Phone: 123-456-7890';
      const result = redactor.redactString(input);
      expect(result).toBe('Phone: [PHONE_REDACTED]');
    });

    it('should redact phone with +1', () => {
      const input = 'Mobile: +1-123-456-7890';
      const result = redactor.redactString(input);
      expect(result).toBe('Mobile: [PHONE_REDACTED]');
    });
  });

  describe('API key redaction', () => {
    it('should redact API keys', () => {
      const input = 'Key: sk_test_1234567890abcdef';
      const result = redactor.redactString(input);
      expect(result).toBe('Key: [API_KEY_REDACTED]');
    });

    it('should redact various key formats', () => {
      const input = 'pk_live_abcdefghij1234567890';
      const result = redactor.redactString(input);
      expect(result).toBe('[API_KEY_REDACTED]');
    });
  });

  describe('Object redaction', () => {
    it('should redact strings in objects', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789',
      };

      const result = redactor.redactObject(obj);
      expect(result).toEqual({
        name: 'John Doe',
        email: '[EMAIL_REDACTED]',
        ssn: '***-**-****',
      });
    });

    it('should redact nested objects', () => {
      const obj = {
        user: {
          profile: {
            email: 'test@example.com',
            phone: '123-456-7890',
          },
        },
      };

      const result = redactor.redactObject(obj);
      expect(result).toEqual({
        user: {
          profile: {
            email: '[EMAIL_REDACTED]',
            phone: '[PHONE_REDACTED]',
          },
        },
      });
    });

    it('should redact arrays', () => {
      const obj = {
        emails: ['alice@test.com', 'bob@example.com'],
      };

      const result = redactor.redactObject(obj);
      expect(result).toEqual({
        emails: ['[EMAIL_REDACTED]', '[EMAIL_REDACTED]'],
      });
    });

    it('should fully redact sensitive keys', () => {
      const obj = {
        username: 'john',
        password: 'secret123',
        apiKey: 'sk_test_abc123',
        token: 'bearer_xyz',
      };

      const result = redactor.redactObject(obj);
      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        apiKey: '[REDACTED]',
        token: '[REDACTED]',
      });
    });

    it('should preserve non-string types', () => {
      const obj = {
        count: 42,
        active: true,
        data: null,
        items: undefined,
      };

      const result = redactor.redactObject(obj);
      expect(result).toEqual(obj);
    });
  });

  describe('Custom patterns', () => {
    it('should support custom patterns', () => {
      const customRedactor = new PIIRedactor([
        {
          name: 'CUSTOM_ID',
          regex: /\bID-\d{6}\b/g,
          replacement: '[ID_REDACTED]',
        },
      ]);

      const input = 'User ID-123456 accessed the system';
      const result = customRedactor.redactString(input);
      expect(result).toBe('User [ID_REDACTED] accessed the system');
    });

    it('should allow adding patterns dynamically', () => {
      redactor.addPattern({
        name: 'CUSTOM',
        regex: /SECRET-\w+/g,
        replacement: '[SECRET]',
      });

      const input = 'Code: SECRET-ABC123';
      const result = redactor.redactString(input);
      expect(result).toBe('Code: [SECRET]');
    });

    it('should allow removing patterns', () => {
      redactor.removePattern('EMAIL');
      const input = 'Email: test@example.com';
      const result = redactor.redactString(input);
      expect(result).toBe('Email: test@example.com'); // Not redacted
    });
  });
});
